import { classifyTopic } from "./desk";
import { totalScore } from "./metrics";
import { buildSentiment } from "./sentiment";
import { databaseName, readTrendDbConfig } from "./trend-db";
import { TREND_DATABASES, type BoosterTopicBrief, type DeskCategory, type LeafForecast, type Topic, type TrendsPayload } from "./types";
import type { HistoryArtifact, HistoryPoint, HistoryReceipt } from "./predict";

export interface CollectWrite {
  snapshotId: string;
  category: DeskCategory;
  ingestedAt: string;
  plugged: string | null;
  topicCount: number;
  sourceUpdatedAt: string;
  words: HistoryPoint[];
}

export interface TrendStore {
  backend: "memory" | "postgres";
  databases: string[];
  write(batch: CollectWrite): Promise<void>;
  history(category: DeskCategory, topicId: string, limit?: number): Promise<HistoryPoint[]>;
  savePredictions(category: DeskCategory, snapshotId: string, forecasts: LeafForecast[]): Promise<void>;
  snapshotCount(category?: DeskCategory): Promise<number>;
}

interface MemoryDb {
  snapshots: CollectWrite[];
  predictions: LeafForecast[];
}

const memory = new Map<DeskCategory, MemoryDb>();

function dbOf(category: DeskCategory): MemoryDb {
  const existing = memory.get(category);
  if (existing) return existing;
  const created: MemoryDb = { snapshots: [], predictions: [] };
  memory.set(category, created);
  return created;
}

function cloneReceipt(receipt: HistoryReceipt): HistoryReceipt {
  return { ...receipt };
}

function clonePoint(point: HistoryPoint): HistoryPoint {
  return {
    ...point,
    artifacts: point.artifacts.map((a) => ({ ...a })),
    receipts: point.receipts?.map(cloneReceipt),
  };
}

const memoryStore: TrendStore = {
  backend: "memory",
  databases: TREND_DATABASES.map((id) => databaseName(id)),
  async write(batch) {
    const db = dbOf(batch.category);
    if (db.snapshots.some((s) => s.snapshotId === batch.snapshotId)) {
      const existing = db.snapshots.find((s) => s.snapshotId === batch.snapshotId);
      if (existing) {
        const incomingArts = batch.words.reduce((n, w) => n + w.artifacts.length, 0);
        const haveArts = existing.words.reduce((n, w) => n + w.artifacts.length, 0);
        if (incomingArts > haveArts) existing.words = batch.words.map(clonePoint);
      }
      return;
    }
    db.snapshots.push({
      ...batch,
      words: batch.words.map(clonePoint),
    });
    if (db.snapshots.length > 48) db.snapshots.splice(0, db.snapshots.length - 48);
  },
  async history(category, topicId, limit = 8) {
    const points = dbOf(category)
      .snapshots
      .flatMap((s) => s.words.filter((w) => w.topicId === topicId).map((w) => clonePoint(w)))
      .toSorted((a, b) => a.at.localeCompare(b.at));
    return points.slice(-limit);
  },
  async savePredictions(category, _snapshotId, forecasts) {
    const db = dbOf(category);
    db.predictions = forecasts;
  },
  async snapshotCount(category) {
    if (category) return dbOf(category).snapshots.length;
    return TREND_DATABASES.reduce((n, id) => n + dbOf(id).snapshots.length, 0);
  },
};

type PgPool = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  end: () => Promise<void>;
};

const pools = new Map<string, PgPool>();

async function pgPool(database: string): Promise<PgPool | null> {
  const cfg = readTrendDbConfig();
  if (!cfg) return null;
  const hit = pools.get(database);
  if (hit) return hit;
  try {
    const pg = (await import("pg")) as { default?: { Pool: new (c: object) => PgPool }; Pool?: new (c: object) => PgPool };
    const Pool = pg.Pool ?? pg.default?.Pool;
    if (!Pool) return null;
    const pool = new Pool({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database,
      ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined,
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 2_000,
    });
    pools.set(database, pool);
    return pool;
  } catch (err) {
    console.warn("[trend-store] postgres driver missing; using memory", err);
    return null;
  }
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asArtifacts(value: unknown): HistoryArtifact[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const rec = row as Record<string, unknown>;
    return [{
      kind: asString(rec.kind),
      value: asString(rec.value),
      mentions: asNumber(rec.mentions),
    }];
  });
}

const receiptColsReady = new Set<string>();

async function ensureReceiptColumns(pool: PgPool, database: string): Promise<void> {
  if (receiptColsReady.has(database)) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS receipts (
      snapshot_id TEXT NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
      topic_id TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      platform TEXT NOT NULL,
      score INT NOT NULL,
      created_at TIMESTAMPTZ,
      source_api TEXT,
      tool TEXT,
      collected_at TIMESTAMPTZ,
      PRIMARY KEY (snapshot_id, topic_id, url)
    )`);
  await pool.query(`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS source_api TEXT`);
  await pool.query(`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS tool TEXT`);
  await pool.query(`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ`);
  receiptColsReady.add(database);
}

const postgresStore: TrendStore = {
  backend: "postgres",
  databases: TREND_DATABASES.map((id) => databaseName(id)),
  async write(batch) {
    const pool = await pgPool(databaseName(batch.category));
    if (!pool) return memoryStore.write(batch);
    try {
      await ensureReceiptColumns(pool, databaseName(batch.category));
    } catch {
      /* receipts table not provisioned yet */
    }
    await pool.query(
      `INSERT INTO snapshots (id, ingested_at, plugged, topic_count, source_updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [batch.snapshotId, batch.ingestedAt, batch.plugged, batch.topicCount, batch.sourceUpdatedAt],
    );
    for (const word of batch.words) {
      await pool.query(
        `INSERT INTO words (snapshot_id, topic_id, label, velocity, score, divergence, receipt_count, first_platform, first_at, driver_weight)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (snapshot_id, topic_id) DO NOTHING`,
        [
          batch.snapshotId,
          word.topicId,
          word.label,
          word.velocity,
          word.score,
          0,
          word.receiptCount,
          word.firstPlatform,
          word.at,
          word.driverWeight,
        ],
      );
      await pool.query(
        `INSERT INTO sentiments (snapshot_id, topic_id, lean, pos, neg, risk, n, thin)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (snapshot_id, topic_id) DO NOTHING`,
        [batch.snapshotId, word.topicId, word.lean, word.pos, word.neg, word.risk, word.n, word.n < 2],
      );
      for (const art of word.artifacts) {
        await pool.query(
          `INSERT INTO artifacts (snapshot_id, topic_id, kind, value, mentions, platforms)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (snapshot_id, topic_id, kind, value) DO NOTHING`,
          [batch.snapshotId, word.topicId, art.kind, art.value, art.mentions, []],
        );
      }
      for (const rec of word.receipts ?? []) {
        if (!rec.url) continue;
        await pool.query(
          `INSERT INTO receipts
            (snapshot_id, topic_id, url, title, platform, score, created_at, source_api, tool, collected_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (snapshot_id, topic_id, url) DO UPDATE SET
             title = EXCLUDED.title,
             platform = EXCLUDED.platform,
             score = EXCLUDED.score,
             created_at = COALESCE(EXCLUDED.created_at, receipts.created_at),
             source_api = COALESCE(EXCLUDED.source_api, receipts.source_api),
             tool = COALESCE(EXCLUDED.tool, receipts.tool),
             collected_at = COALESCE(EXCLUDED.collected_at, receipts.collected_at)`,
          [
            batch.snapshotId,
            word.topicId,
            rec.url,
            rec.title,
            rec.platform,
            rec.score,
            rec.createdAt,
            rec.sourceApi ?? null,
            rec.tool ?? null,
            rec.collectedAt ?? null,
          ],
        );
      }
    }
  },
  async history(category, topicId, limit = 8) {
    const pool = await pgPool(databaseName(category));
    if (!pool) return memoryStore.history(category, topicId, limit);
    const words = await pool.query(
      `SELECT w.snapshot_id, w.topic_id, w.label, w.velocity, w.score, w.receipt_count, w.first_platform, w.first_at,
              w.driver_weight, s.lean, s.pos, s.neg, s.risk, s.n, snap.ingested_at
       FROM words w
       JOIN snapshots snap ON snap.id = w.snapshot_id
       JOIN sentiments s ON s.snapshot_id = w.snapshot_id AND s.topic_id = w.topic_id
       WHERE w.topic_id = $1
       ORDER BY snap.ingested_at ASC
       LIMIT $2`,
      [topicId, limit],
    );
    const arts = await pool.query(
      `SELECT snapshot_id, kind, value, mentions FROM artifacts WHERE topic_id = $1`,
      [topicId],
    );
    const bySnap = new Map<string, HistoryArtifact[]>();
    for (const row of arts.rows) {
      const sid = asString(row.snapshot_id);
      const list = bySnap.get(sid) ?? [];
      list.push({ kind: asString(row.kind), value: asString(row.value), mentions: asNumber(row.mentions) });
      bySnap.set(sid, list);
    }
    return words.rows.map((row) => ({
      at: asString(row.ingested_at) || asString(row.first_at),
      topicId: asString(row.topic_id, topicId),
      label: asString(row.label),
      velocity: (asString(row.velocity, "peaking") as HistoryPoint["velocity"]),
      score: asNumber(row.score),
      lean: (asString(row.lean, "thin") as HistoryPoint["lean"]),
      pos: asNumber(row.pos),
      neg: asNumber(row.neg),
      risk: asNumber(row.risk),
      n: asNumber(row.n),
      receiptCount: asNumber(row.receipt_count),
      firstPlatform: asString(row.first_platform) || null,
      driverWeight: row.driver_weight == null ? null : asNumber(row.driver_weight),
      artifacts: asArtifacts(bySnap.get(asString(row.snapshot_id))),
    }));
  },
  async savePredictions(category, snapshotId, forecasts) {
    const pool = await pgPool(databaseName(category));
    if (!pool) return memoryStore.savePredictions(category, snapshotId, forecasts);
    const at = new Date().toISOString();
    for (const f of forecasts) {
      await pool.query(
        `INSERT INTO predictions
          (id, snapshot_id, topic_id, leaf_id, leaf_kind, outlook, sentiment_lean, confidence, analysis, evidence, thin, predicted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
           outlook = EXCLUDED.outlook,
           sentiment_lean = EXCLUDED.sentiment_lean,
           confidence = EXCLUDED.confidence,
           analysis = EXCLUDED.analysis,
           evidence = EXCLUDED.evidence,
           thin = EXCLUDED.thin,
           predicted_at = EXCLUDED.predicted_at`,
        [
          `${snapshotId}:${f.leafId}`,
          snapshotId,
          f.topicId,
          f.leafId,
          f.kind,
          f.outlook,
          f.sentimentLean,
          f.confidence,
          f.analysis,
          f.evidence,
          f.thin,
          at,
        ],
      );
    }
  },
  async snapshotCount(category) {
    if (!category) {
      const counts = await Promise.all(TREND_DATABASES.map((id) => postgresStore.snapshotCount(id)));
      return counts.reduce((a, b) => a + b, 0);
    }
    const pool = await pgPool(databaseName(category));
    if (!pool) return memoryStore.snapshotCount(category);
    const res = await pool.query(`SELECT COUNT(*)::int AS n FROM snapshots`);
    return asNumber(res.rows[0]?.n);
  },
};

export function trendStore(): TrendStore {
  return readTrendDbConfig() ? postgresStore : memoryStore;
}

function receiptsFromTopic(topic: Topic): HistoryReceipt[] {
  return Object.values(topic.platforms).flatMap((s) =>
    s.posts.map((p) => ({
      url: p.url,
      title: p.title,
      platform: p.platform,
      score: p.score,
      createdAt: p.createdAt || null,
      sourceApi: p.sourceApi,
      tool: p.tool,
      collectedAt: p.collectedAt,
    })),
  );
}

export function wordFromTopic(topic: Topic, brief?: BoosterTopicBrief, at = new Date().toISOString()): HistoryPoint {
  const sentiment = brief?.sentiment ?? buildSentiment(topic);
  const receipts = receiptsFromTopic(topic);
  return {
    at,
    topicId: topic.id,
    label: topic.label,
    velocity: topic.velocity,
    score: totalScore(topic),
    lean: sentiment.lean,
    pos: sentiment.overall.pos,
    neg: sentiment.overall.neg,
    risk: sentiment.overall.risk,
    n: sentiment.overall.n,
    receiptCount: receipts.length,
    firstPlatform: brief?.causation.firstPlatform ?? null,
    driverWeight: brief?.causation.drivers[0]?.weight ?? null,
    artifacts: (brief?.artifacts ?? []).map((a) => ({
      kind: a.kind,
      value: a.value,
      mentions: a.mentions,
    })),
    receipts,
  };
}

export function categoryOf(topic: Topic, brief?: BoosterTopicBrief): DeskCategory {
  return brief?.category ?? classifyTopic(topic, brief?.artifacts ?? []);
}

export async function collectTape(
  payload: TrendsPayload,
  briefs: BoosterTopicBrief[] = [],
  opts?: { snapshotId?: string },
): Promise<{ snapshotId: string; store: TrendStore; wrote: number }> {
  const store = trendStore();
  const snapshotId = opts?.snapshotId ?? `${payload.updatedAt}|${payload.plugged ?? "tape"}`;
  const at = payload.updatedAt;
  const briefById = new Map(briefs.map((b) => [b.topicId, b]));
  const byCategory = new Map<DeskCategory, HistoryPoint[]>();

  for (const topic of payload.topics) {
    const brief = briefById.get(topic.id);
    const cat = categoryOf(topic, brief);
    const point = wordFromTopic(topic, brief, at);
    const bucket = byCategory.get(cat) ?? [];
    bucket.push(point);
    byCategory.set(cat, bucket);
  }

  const allWords = [...byCategory.values()].flat();
  const batches: CollectWrite[] = [
    {
      snapshotId,
      category: "all",
      ingestedAt: at,
      plugged: payload.plugged ?? null,
      topicCount: allWords.length,
      sourceUpdatedAt: payload.updatedAt,
      words: allWords,
    },
    ...[...byCategory.entries()].map(([category, words]) => ({
      snapshotId,
      category,
      ingestedAt: at,
      plugged: payload.plugged ?? null,
      topicCount: words.length,
      sourceUpdatedAt: payload.updatedAt,
      words,
    })),
  ];

  await Promise.all(batches.map((batch) => store.write(batch)));
  return { snapshotId, store, wrote: batches.length };
}

export async function historyForTopics(
  store: TrendStore,
  category: DeskCategory,
  topicIds: string[],
): Promise<Map<string, HistoryPoint[]>> {
  const out = new Map<string, HistoryPoint[]>();
  await Promise.all(
    topicIds.map(async (id) => {
      out.set(id, await store.history(category, id));
    }),
  );
  return out;
}
