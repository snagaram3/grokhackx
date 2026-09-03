import { slug } from "./metrics";
import { overlapRows, occupancyExamples, scorePoi, type PoiReceipt } from "./poi";
import { decodeQrFromImageUrl, isQrImageUrl, payloadFromQrImageUrl } from "./qr";
import {
  examplesFromCounts,
  fitHistGb,
  MIN_OCCUPANCY_LABELS,
  parseHistGbModel,
  predictOutlook,
  windowVector,
  type HistGbModel,
} from "./histgb";
import { databaseName, readTrendDbConfig } from "./trend-db";
import type { PoiInsight, PoiTag, Post, TrendsPayload, WatchlistEntity } from "./types";
import { emptyWatchStore, parseWatchStore, type TapeWatchStore } from "./watch";

const OWNER = "demo";

const WATCHLIST_SQL = `
CREATE TABLE IF NOT EXISTS watchlist (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL DEFAULT 'demo',
  label TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS watchlist_owner_idx ON watchlist (owner);
CREATE TABLE IF NOT EXISTS poi_overlap (
  entity_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  host TEXT NOT NULL DEFAULT '',
  official BOOLEAN NOT NULL DEFAULT false,
  collected_at TIMESTAMPTZ,
  PRIMARY KEY (entity_id, snapshot_id, url)
);
CREATE INDEX IF NOT EXISTS poi_overlap_entity_idx ON poi_overlap (entity_id);
CREATE TABLE IF NOT EXISTS poi_scores (
  entity_id TEXT PRIMARY KEY,
  scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  receipt_count INT NOT NULL,
  official_count INT NOT NULL,
  occupied_count INT NOT NULL,
  organic REAL NOT NULL,
  occupancy REAL NOT NULL,
  outlook TEXT NOT NULL,
  confidence REAL NOT NULL,
  thin BOOLEAN NOT NULL,
  delta INT NOT NULL DEFAULT 0,
  baseline_ratio REAL NOT NULL DEFAULT 0,
  snapshot_count INT NOT NULL DEFAULT 0,
  rank_score REAL NOT NULL DEFAULT 0,
  window_counts INT[] NOT NULL DEFAULT '{}'
);
ALTER TABLE poi_scores ADD COLUMN IF NOT EXISTS window_counts INT[] NOT NULL DEFAULT '{}';
ALTER TABLE poi_overlap ADD COLUMN IF NOT EXISTS qr_payload TEXT;
CREATE TABLE IF NOT EXISTS poi_labels (
  entity_id TEXT NOT NULL,
  url TEXT NOT NULL,
  tag TEXT NOT NULL CHECK (tag IN ('official','occupied','ignore')),
  PRIMARY KEY (entity_id, url)
);
CREATE TABLE IF NOT EXISTS poi_models (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  samples INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS tape_watch (
  owner TEXT PRIMARY KEY,
  payload JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

type PgPool = {
  query: (
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

const memory: WatchlistEntity[] = [];
const memoryLabels = new Map<string, Map<string, PoiTag>>();
const memoryQr = new Map<string, string>();
const memoryBlobs = new Map<string, unknown>();
let memoryTape: TapeWatchStore = emptyWatchStore();
let schemaReady = false;
let pool: PgPool | null | undefined;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asAliases(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  return [];
}

async function allPool(): Promise<PgPool | null> {
  const cfg = readTrendDbConfig();
  if (!cfg) return null;
  if (pool !== undefined) return pool;
  try {
    const pg = (await import("pg")) as { default?: { Pool: new (c: object) => PgPool }; Pool?: new (c: object) => PgPool };
    const Pool = pg.Pool ?? pg.default?.Pool;
    if (!Pool) {
      pool = null;
      return null;
    }
    pool = new Pool({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: databaseName("all"),
      ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined,
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 2_000,
    });
    return pool;
  } catch {
    pool = null;
    return null;
  }
}

async function ensureSchema(db: PgPool): Promise<void> {
  if (schemaReady) return;
  await db.query(WATCHLIST_SQL);
  schemaReady = true;
}

function rowToEntity(row: Record<string, unknown>): WatchlistEntity {
  return {
    id: asString(row.id),
    label: asString(row.label),
    aliases: asAliases(row.aliases),
    owner: asString(row.owner, OWNER),
    createdAt: asString(row.created_at) || new Date().toISOString(),
  };
}

export async function listWatchlist(): Promise<{ backend: "postgres" | "memory"; entities: WatchlistEntity[] }> {
  const db = await allPool();
  if (!db) return { backend: "memory", entities: [...memory] };
  await ensureSchema(db);
  const res = await db.query(
    `SELECT id, owner, label, aliases, created_at FROM watchlist WHERE owner = $1 ORDER BY created_at ASC`,
    [OWNER],
  );
  return { backend: "postgres", entities: res.rows.map(rowToEntity) };
}

export async function addWatchlist(label: string, aliases: string[]): Promise<WatchlistEntity> {
  const entity: WatchlistEntity = {
    id: slug(label) || `poi-${Date.now()}`,
    label: label.trim().slice(0, 80),
    aliases,
    owner: OWNER,
    createdAt: new Date().toISOString(),
  };
  const db = await allPool();
  if (!db) {
    const i = memory.findIndex((e) => e.id === entity.id);
    if (i >= 0) memory[i] = { ...memory[i], aliases: entity.aliases };
    else memory.push(entity);
    return memory.find((e) => e.id === entity.id) ?? entity;
  }
  await ensureSchema(db);
  await db.query(
    `INSERT INTO watchlist (id, owner, label, aliases, created_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, aliases = EXCLUDED.aliases`,
    [entity.id, OWNER, entity.label, entity.aliases, entity.createdAt],
  );
  return entity;
}

export async function removeWatchlist(id: string): Promise<boolean> {
  const db = await allPool();
  if (!db) {
    const n = memory.length;
    const next = memory.filter((e) => e.id !== id);
    memory.splice(0, memory.length, ...next);
    return next.length !== n;
  }
  await ensureSchema(db);
  await db.query(`DELETE FROM poi_overlap WHERE entity_id = $1`, [id]);
  await db.query(`DELETE FROM poi_scores WHERE entity_id = $1`, [id]);
  const res = await db.query(`DELETE FROM watchlist WHERE id = $1 AND owner = $2`, [id, OWNER]);
  return (res.rowCount ?? 0) > 0;
}

async function loadReceipts(db: PgPool | null): Promise<PoiReceipt[]> {
  if (!db) return [];
  try {
    const res = await db.query(
      `SELECT snapshot_id, url, title, platform, score, created_at, source_api, tool, collected_at
       FROM receipts
       ORDER BY collected_at DESC NULLS LAST
       LIMIT 4000`,
    );
    return res.rows.map((row) => ({
      snapshotId: asString(row.snapshot_id),
      url: asString(row.url),
      title: asString(row.title),
      platform: asString(row.platform),
      score: Number(row.score) || 0,
      createdAt: asString(row.created_at) || null,
      sourceApi: asString(row.source_api) || undefined,
      tool: asString(row.tool) || undefined,
      collectedAt: asString(row.collected_at) || undefined,
    }));
  } catch (err) {
    console.warn("[watchlist] receipts", err instanceof Error ? err.message : err);
    return [];
  }
}

function postsToReceipts(payload: TrendsPayload | null): PoiReceipt[] {
  if (!payload) return [];
  const snap = payload.updatedAt || "memory";
  const posts: Post[] = payload.topics.flatMap((t) =>
    Object.values(t.platforms).flatMap((s) => s.posts),
  );
  return posts.map((p) => ({
    snapshotId: snap,
    url: p.url,
    title: p.title,
    platform: p.platform,
    score: p.score,
    createdAt: p.createdAt || null,
    sourceApi: p.sourceApi,
    tool: p.tool,
    collectedAt: p.collectedAt,
  }));
}

export async function insightsFor(
  entities: WatchlistEntity[],
  tape?: TrendsPayload | null,
): Promise<PoiInsight[]> {
  const db = await allPool();
  if (db) await ensureSchema(db);
  const fromSql = await loadReceipts(db);
  const fromTape = postsToReceipts(tape ?? null);
  const seen = new Set<string>();
  const receipts: PoiReceipt[] = [];
  for (const r of [...fromSql, ...fromTape]) {
    const key = `${r.snapshotId}|${r.url}`;
    if (!r.url || seen.has(key)) continue;
    seen.add(key);
    receipts.push(r);
  }
  const labels = await loadLabels(db, entities.map((e) => e.id));
  const qr = await collectQr(db, receipts);
  const gold = entities.flatMap((e) => occupancyExamples(e, receipts, labels.get(e.id) ?? new Map(), qr));
  let occupancyModel = gold.length >= MIN_OCCUPANCY_LABELS ? fitHistGb(gold, 2) : null;
  if (!occupancyModel) occupancyModel = await loadStoredModel("occupancy");
  else await saveStoredModel("occupancy", occupancyModel);
  const insights = entities.map((e) =>
    scorePoi(e, receipts, { labels: labels.get(e.id), qr, occupancyModel }),
  );
  if (db) {
    const stored = await loadStoredWindows(db, entities.map((e) => e.id));
    for (const row of insights) {
      const prior = stored.get(row.entity.id) ?? [];
      if (prior.length > row.window.length) row.window = prior;
    }
    await persistInsights(db, insights, receipts).catch((err) => {
      console.warn("[watchlist] persist overlap", err instanceof Error ? err.message : err);
    });
  }
  const nwExamples = insights.flatMap((row) =>
    examplesFromCounts(
      row.window,
      row.window.map(() => row.baselineRatio),
      row.occupancy,
      row.organic,
    ),
  );
  let nwModel = fitHistGb(nwExamples);
  if (!nwModel) nwModel = await loadStoredModel("next-window");
  else await saveStoredModel("next-window", nwModel);
  for (const row of insights) {
    if (row.thin || row.window.length < 2) {
      row.model = { name: "stump", samples: nwExamples.length };
      continue;
    }
    if (!nwModel) {
      row.model = { name: "stump", samples: nwExamples.length };
      continue;
    }
    row.outlook = predictOutlook(
      nwModel,
      windowVector(
        row.window,
        row.baselineRatio,
        row.baselineRatio,
        row.occupancy,
        row.organic,
      ),
    );
    row.model = { name: "histgb", samples: nwModel.samples };
  }
  return insights.toSorted((a, b) => b.rankScore - a.rankScore || b.receiptCount - a.receiptCount);
}

async function loadStoredWindows(db: PgPool, ids: string[]): Promise<Map<string, number[]>> {
  const map = new Map<string, number[]>();
  if (!ids.length) return map;
  try {
    const res = await db.query(`SELECT entity_id, window_counts FROM poi_scores WHERE entity_id = ANY($1)`, [ids]);
    for (const row of res.rows) {
      const id = asString(row.entity_id);
      const win = Array.isArray(row.window_counts) ? row.window_counts.map((n) => Number(n) || 0) : [];
      if (id && win.length) map.set(id, win);
    }
  } catch {
    /* column missing until ensureSchema */
  }
  return map;
}

async function persistInsights(
  db: PgPool,
  insights: PoiInsight[],
  receipts: PoiReceipt[],
): Promise<void> {
  await ensureSchema(db);
  for (const insight of insights) {
    const rows = overlapRows(insight.entity, receipts);
    for (const row of rows.slice(0, 800)) {
      await db.query(
        `INSERT INTO poi_overlap (entity_id, snapshot_id, url, title, host, official, collected_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (entity_id, snapshot_id, url) DO UPDATE SET
           title = EXCLUDED.title,
           host = EXCLUDED.host,
           official = EXCLUDED.official`,
        [row.entityId, row.snapshotId, row.url, row.title, row.host, row.official, row.collectedAt],
      );
      const payload = memoryQr.get(row.url) ?? payloadFromQrImageUrl(row.url);
      if (payload) {
        await db.query(
          `UPDATE poi_overlap SET qr_payload = $1 WHERE entity_id = $2 AND snapshot_id = $3 AND url = $4 AND (qr_payload IS NULL OR qr_payload = '')`,
          [payload, row.entityId, row.snapshotId, row.url],
        );
      }
    }
    await db.query(
      `INSERT INTO poi_scores (
         entity_id, scored_at, receipt_count, official_count, occupied_count,
         organic, occupancy, outlook, confidence, thin, delta, baseline_ratio,
         snapshot_count, rank_score, window_counts
       ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (entity_id) DO UPDATE SET
         scored_at = EXCLUDED.scored_at,
         receipt_count = EXCLUDED.receipt_count,
         official_count = EXCLUDED.official_count,
         occupied_count = EXCLUDED.occupied_count,
         organic = EXCLUDED.organic,
         occupancy = EXCLUDED.occupancy,
         outlook = EXCLUDED.outlook,
         confidence = EXCLUDED.confidence,
         thin = EXCLUDED.thin,
         delta = EXCLUDED.delta,
         baseline_ratio = EXCLUDED.baseline_ratio,
         snapshot_count = EXCLUDED.snapshot_count,
         rank_score = EXCLUDED.rank_score,
         window_counts = EXCLUDED.window_counts`,
      [
        insight.entity.id,
        insight.receiptCount,
        insight.officialCount,
        insight.occupiedCount,
        insight.organic,
        insight.occupancy,
        insight.outlook,
        insight.confidence,
        insight.thin,
        insight.delta,
        insight.baselineRatio,
        insight.snapshotCount,
        insight.rankScore,
        insight.window,
      ],
    );
  }
}

async function loadLabels(
  db: PgPool | null,
  ids: string[],
): Promise<Map<string, Map<string, PoiTag>>> {
  const out = new Map<string, Map<string, PoiTag>>();
  for (const id of ids) {
    const mem = memoryLabels.get(id);
    if (mem) out.set(id, new Map(mem));
  }
  if (!db || !ids.length) return out;
  try {
    const res = await db.query(`SELECT entity_id, url, tag FROM poi_labels WHERE entity_id = ANY($1)`, [ids]);
    for (const row of res.rows) {
      const id = asString(row.entity_id);
      const url = asString(row.url);
      const tag = asString(row.tag) as PoiTag;
      if (!id || !url || (tag !== "official" && tag !== "occupied" && tag !== "ignore")) continue;
      const map = out.get(id) ?? new Map<string, PoiTag>();
      map.set(url, tag);
      out.set(id, map);
    }
  } catch {
    /* schema not ready */
  }
  return out;
}

async function collectQr(db: PgPool | null, receipts: PoiReceipt[]): Promise<Map<string, string>> {
  const qr = new Map<string, string>(memoryQr);
  if (db) {
    try {
      const res = await db.query(`SELECT url, qr_payload FROM poi_overlap WHERE qr_payload IS NOT NULL AND qr_payload <> ''`);
      for (const row of res.rows) {
        const url = asString(row.url);
        const payload = asString(row.qr_payload);
        if (url && payload) qr.set(url, payload);
      }
    } catch {
      /* column missing */
    }
  }
  let fetches = 0;
  for (const r of receipts) {
    if (qr.has(r.url)) continue;
    const encoded = payloadFromQrImageUrl(r.url);
    if (encoded) {
      qr.set(r.url, encoded);
      memoryQr.set(r.url, encoded);
      continue;
    }
    if (!isQrImageUrl(r.url) || fetches >= 8) continue;
    fetches += 1;
    const decoded = await decodeQrFromImageUrl(r.url);
    if (decoded) {
      qr.set(r.url, decoded);
      memoryQr.set(r.url, decoded);
    }
  }
  return qr;
}

export async function tagReceipt(entityId: string, url: string, tag: PoiTag): Promise<void> {
  const map = memoryLabels.get(entityId) ?? new Map<string, PoiTag>();
  map.set(url, tag);
  memoryLabels.set(entityId, map);
  const db = await allPool();
  if (!db) return;
  await ensureSchema(db);
  await db.query(
    `INSERT INTO poi_labels (entity_id, url, tag) VALUES ($1, $2, $3)
     ON CONFLICT (entity_id, url) DO UPDATE SET tag = EXCLUDED.tag`,
    [entityId, url, tag],
  );
}

export async function readModelBlob(id: string): Promise<unknown | null> {
  if (memoryBlobs.has(id)) return memoryBlobs.get(id) ?? null;
  const db = await allPool();
  if (!db) return null;
  try {
    await ensureSchema(db);
    const res = await db.query(`SELECT payload FROM poi_models WHERE id = $1`, [id]);
    const payload = res.rows[0]?.payload ?? null;
    if (payload != null) memoryBlobs.set(id, payload);
    return payload;
  } catch {
    return null;
  }
}

export async function writeModelBlob(id: string, payload: unknown, samples = 0): Promise<void> {
  memoryBlobs.set(id, payload);
  const db = await allPool();
  if (!db) return;
  try {
    await ensureSchema(db);
    await db.query(
      `INSERT INTO poi_models (id, payload, samples, updated_at) VALUES ($1, $2::jsonb, $3, NOW())
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, samples = EXCLUDED.samples, updated_at = NOW()`,
      [id, JSON.stringify(payload), samples],
    );
  } catch (err) {
    console.warn("[watchlist] poi_models", err instanceof Error ? err.message : err);
  }
}

async function loadStoredModel(id: string): Promise<HistGbModel | null> {
  return parseHistGbModel(await readModelBlob(id));
}

async function saveStoredModel(id: string, model: HistGbModel): Promise<void> {
  await writeModelBlob(id, model, model.samples);
}

export async function loadTapeWatch(): Promise<{ backend: "postgres" | "memory"; store: TapeWatchStore }> {
  const db = await allPool();
  if (!db) return { backend: "memory", store: memoryTape };
  await ensureSchema(db);
  try {
    const res = await db.query(`SELECT payload FROM tape_watch WHERE owner = $1`, [OWNER]);
    const raw = res.rows[0]?.payload;
    if (raw == null) return { backend: "postgres", store: memoryTape };
    const store = parseWatchStore(typeof raw === "string" ? raw : JSON.stringify(raw));
    return { backend: "postgres", store };
  } catch (err) {
    console.warn("[tape-watch] load", err instanceof Error ? err.message : err);
    return { backend: "postgres", store: memoryTape };
  }
}

export async function saveTapeWatch(store: TapeWatchStore): Promise<{ backend: "postgres" | "memory" }> {
  memoryTape = { ids: [...store.ids], snaps: { ...store.snaps } };
  const db = await allPool();
  if (!db) return { backend: "memory" };
  await ensureSchema(db);
  await db.query(
    `INSERT INTO tape_watch (owner, payload, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (owner) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
    [OWNER, JSON.stringify(store)],
  );
  return { backend: "postgres" };
}
