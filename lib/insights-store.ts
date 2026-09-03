import { slug } from "./metrics";
import { databaseName, readTrendDbConfig } from "./trend-db";
import type { RootReceipt } from "./insights-types";

export interface CachedRoot {
  wikiTitle: string | null;
  wikiUrl: string | null;
  firstAt: string | null;
  firstEditor: string | null;
  parents: string[];
  patents: RootReceipt[];
  inceptionAt: string | null;
  inceptionSource: "wikidata" | "extract" | "category" | null;
  inceptionUrl: string | null;
  cachedAt: string;
}

const ROOTS_SQL = `
CREATE TABLE IF NOT EXISTS insight_roots (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  sense TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS insight_roots_query_idx ON insight_roots (query);
`;

type PgPool = {
  query: (
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

const memory = new Map<string, CachedRoot>();
let schemaReady = false;
let pool: PgPool | null | undefined;

export function rootCacheId(query: string, sense = ""): string {
  return `${slug(query)}::${slug(sense) || "_"}`;
}

export function asCached(raw: unknown): CachedRoot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const patents = Array.isArray(o.patents)
    ? o.patents.filter((p): p is RootReceipt => Boolean(p && typeof p === "object" && "url" in p && "title" in p))
    : [];
  const src = o.inceptionSource;
  return {
    wikiTitle: typeof o.wikiTitle === "string" ? o.wikiTitle : null,
    wikiUrl: typeof o.wikiUrl === "string" ? o.wikiUrl : null,
    firstAt: typeof o.firstAt === "string" ? o.firstAt : null,
    firstEditor: typeof o.firstEditor === "string" ? o.firstEditor : null,
    parents: Array.isArray(o.parents) ? o.parents.map(String) : [],
    patents,
    inceptionAt: typeof o.inceptionAt === "string" ? o.inceptionAt : null,
    inceptionSource:
      src === "wikidata" || src === "extract" || src === "category" ? src : null,
    inceptionUrl: typeof o.inceptionUrl === "string" ? o.inceptionUrl : null,
    cachedAt: typeof o.cachedAt === "string" ? o.cachedAt : new Date().toISOString(),
  };
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
  await db.query(ROOTS_SQL);
  schemaReady = true;
}

export function mergePatents(a: RootReceipt[], b: RootReceipt[]): RootReceipt[] {
  const byUrl = new Map<string, RootReceipt>();
  for (const p of [...a, ...b]) {
    const prev = byUrl.get(p.url);
    if (!prev) {
      byUrl.set(p.url, p);
      continue;
    }
    const pt = prev.at ? Date.parse(prev.at) : Infinity;
    const nt = p.at ? Date.parse(p.at) : Infinity;
    if (nt < pt) byUrl.set(p.url, p);
  }
  return [...byUrl.values()];
}

export async function loadInsightRoot(query: string, sense = ""): Promise<CachedRoot | null> {
  const id = rootCacheId(query, sense);
  const db = await allPool();
  if (!db) return memory.get(id) ?? null;
  try {
    await ensureSchema(db);
    const res = await db.query(`SELECT payload FROM insight_roots WHERE id = $1`, [id]);
    const row = res.rows[0];
    return asCached(row?.payload) ?? memory.get(id) ?? null;
  } catch (err) {
    console.warn("[insights-store] load", err instanceof Error ? err.message : err);
    return memory.get(id) ?? null;
  }
}

export async function saveInsightRoot(query: string, sense: string, payload: CachedRoot): Promise<void> {
  const id = rootCacheId(query, sense);
  const next: CachedRoot = { ...payload, cachedAt: new Date().toISOString() };
  memory.set(id, next);
  const db = await allPool();
  if (!db) return;
  try {
    await ensureSchema(db);
    await db.query(
      `INSERT INTO insight_roots (id, query, sense, payload, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET query = $2, sense = $3, payload = $4::jsonb, updated_at = NOW()`,
      [id, query.slice(0, 120), sense.slice(0, 120), JSON.stringify(next)],
    );
  } catch (err) {
    console.warn("[insights-store] save", err instanceof Error ? err.message : err);
  }
}
