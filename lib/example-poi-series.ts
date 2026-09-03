import { nextWindowFromSeries } from "./poi";
import { databaseName, readTrendDbConfig } from "./trend-db";
import type { ExamplePoiCompare, ExamplePoiIndustry, ForecastOutlook } from "./types";

export interface IndustryHourSnap {
  hour: string;
  counts: Partial<Record<ExamplePoiIndustry, number>>;
  locatedCount: number;
}

const MAX_HOURS = 8;

const INDUSTRY_HOUR_SQL = `
CREATE TABLE IF NOT EXISTS industry_hour (
  hour TIMESTAMPTZ PRIMARY KEY,
  counts JSONB NOT NULL DEFAULT '{}',
  located_count INT NOT NULL DEFAULT 0
);
`;

type PgPool = {
  query: (
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

const series: IndustryHourSnap[] = [];
let pool: PgPool | null | undefined;
let schemaReady = false;
let hydratePromise: Promise<void> | null = null;

export function hourBucket(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 13) + ":00:00.000Z";
  d.setUTCMinutes(0, 0, 0);
  d.setUTCMilliseconds(0);
  return d.toISOString();
}

async function allPool(): Promise<PgPool | null> {
  const cfg = readTrendDbConfig();
  if (!cfg) return null;
  if (pool !== undefined) return pool;
  try {
    const pg = (await import("pg")) as {
      default?: { Pool: new (c: object) => PgPool };
      Pool?: new (c: object) => PgPool;
    };
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
  await db.query(INDUSTRY_HOUR_SQL);
  schemaReady = true;
}

function applySnaps(rows: IndustryHourSnap[]): void {
  series.length = 0;
  series.push(...rows.toSorted((a, b) => a.hour.localeCompare(b.hour)).slice(-MAX_HOURS));
}

async function loadFromDb(): Promise<void> {
  const db = await allPool();
  if (!db) return;
  try {
    await ensureSchema(db);
    const res = await db.query(
      `SELECT hour, counts, located_count
       FROM industry_hour
       ORDER BY hour ASC
       LIMIT $1`,
      [MAX_HOURS],
    );
    const loaded: IndustryHourSnap[] = res.rows.map((row) => {
      const hourRaw = row.hour;
      const hour =
        hourRaw instanceof Date
          ? hourRaw.toISOString()
          : hourBucket(typeof hourRaw === "string" ? hourRaw : new Date().toISOString());
      const counts =
        row.counts && typeof row.counts === "object" && !Array.isArray(row.counts)
          ? (row.counts as IndustryHourSnap["counts"])
          : typeof row.counts === "string"
            ? (JSON.parse(row.counts) as IndustryHourSnap["counts"])
            : {};
      return {
        hour,
        counts,
        locatedCount: Number(row.located_count) || 0,
      };
    });
    if (loaded.length) applySnaps(loaded);
  } catch (err) {
    console.warn("[industry-hour] load", err instanceof Error ? err.message : err);
  }
}

async function flushSeries(): Promise<void> {
  const db = await allPool();
  if (!db) return;
  try {
    await ensureSchema(db);
    await db.query("BEGIN");
    await db.query("DELETE FROM industry_hour");
    for (const snap of series) {
      await db.query(
        `INSERT INTO industry_hour (hour, counts, located_count)
         VALUES ($1::timestamptz, $2::jsonb, $3)`,
        [snap.hour, JSON.stringify(snap.counts), snap.locatedCount],
      );
    }
    await db.query("COMMIT");
  } catch (err) {
    try {
      await db.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.warn("[industry-hour] flush", err instanceof Error ? err.message : err);
  }
}

/** Load Cloud SQL (or no-op) once so cold starts keep the hourly window. */
export function hydrateIndustrySeries(): Promise<void> {
  if (!hydratePromise) hydratePromise = loadFromDb();
  return hydratePromise;
}

export function recordIndustryHour(compare: ExamplePoiCompare, at = compare.collectedAt): IndustryHourSnap {
  const hour = hourBucket(at);
  const counts: IndustryHourSnap["counts"] = {};
  for (const row of compare.industries) counts[row.category] = row.liveNear;
  const snap: IndustryHourSnap = { hour, counts, locatedCount: compare.locatedCount };
  const idx = series.findIndex((s) => s.hour === hour);
  if (idx >= 0) series[idx] = snap;
  else series.push(snap);
  series.sort((a, b) => a.hour.localeCompare(b.hour));
  if (series.length > MAX_HOURS) series.splice(0, series.length - MAX_HOURS);
  void flushSeries();
  return snap;
}

export function industryWindow(category: ExamplePoiIndustry): number[] {
  return series.map((s) => s.counts[category] ?? 0);
}

export function industryBaselines(category: ExamplePoiIndustry): { last: number; prev: number } {
  const last = series.at(-1);
  const prev = series.at(-2);
  const lastCount = last?.counts[category] ?? 0;
  const prevCount = prev?.counts[category] ?? 0;
  const lastBase = last && last.locatedCount > 0 ? lastCount / last.locatedCount : 0;
  const prevBase = prev && prev.locatedCount > 0 ? prevCount / prev.locatedCount : 0;
  return { last: lastBase, prev: prevBase };
}

export function industryOutlookFromHours(
  category: ExamplePoiIndustry,
  liveNear: number,
): { outlook: ForecastOutlook; window: number[] } {
  const window = industryWindow(category);
  const seriesWindow = window.length ? window : [liveNear];
  const { last, prev } = industryBaselines(category);
  if (seriesWindow.length < 2) {
    return { outlook: "thin", window: seriesWindow };
  }
  return { outlook: nextWindowFromSeries(seriesWindow, last, prev), window: seriesWindow };
}

export function peekIndustrySeries(): IndustryHourSnap[] {
  return series.map((s) => ({ ...s, counts: { ...s.counts } }));
}

export function resetIndustrySeries(): void {
  series.length = 0;
  hydratePromise = Promise.resolve();
}
