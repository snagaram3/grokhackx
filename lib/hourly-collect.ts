import { boostTrends } from "./booster";
import { hydrateIndustrySeries, recordIndustryHour } from "./example-poi-series";
import { cachePeek } from "./cache";
import { fleetHealth, type FleetHealth } from "./fleet";
import { collectTape } from "./trend-store";
import { readTrendDbConfig } from "./trend-db";
import { trendStore } from "./trend-store";
import type { TrendsPayload } from "./types";
import { listWatchlist } from "./watchlist-store";

const PHRASE_CAP = 4;
const LOOKUP_MS = 25_000;

export interface HourlyCollectResult {
  backend: "memory" | "postgres";
  configured: boolean;
  fleet: FleetHealth;
  hour: string;
  snapped: string[];
  skipped: string[];
  snapshots: number;
}

function hourBucket(at = new Date()): string {
  const d = new Date(at);
  d.setUTCMinutes(0, 0, 0);
  d.setUTCMilliseconds(0);
  return d.toISOString();
}

function uniquePhrases(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const phrase = (raw ?? "").trim();
    if (phrase.length < 2) continue;
    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(phrase);
    if (out.length >= PHRASE_CAP) break;
  }
  return out;
}

async function lookupTape(origin: string, phrase: string): Promise<TrendsPayload | null> {
  const url = `${origin}/api/trends?topic=${encodeURIComponent(phrase)}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(LOOKUP_MS),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as TrendsPayload;
}

export async function runHourlyCollect(origin: string): Promise<HourlyCollectResult> {
  const hour = hourBucket();
  const [fleet, watch] = await Promise.all([fleetHealth(), listWatchlist(), hydrateIndustrySeries()]);
  const tape = cachePeek<TrendsPayload>("trends:v1");
  const phrases = uniquePhrases([...watch.entities.map((e) => e.label), tape?.plugged]);

  const snapped: string[] = [];
  const skipped: string[] = [];

  if (phrases.length === 0 && tape) {
    const boosted = boostTrends(tape);
    await collectTape(tape, boosted.briefs, { snapshotId: `${hour}|tape` });
    if (tape.poiCompare) recordIndustryHour(tape.poiCompare, hour);
    snapped.push("tape");
  }

  await Promise.all(
    phrases.map(async (phrase) => {
      try {
        const payload = await lookupTape(origin, phrase);
        if (!payload) {
          skipped.push(phrase);
          return;
        }
        const boosted = boostTrends(payload);
        await collectTape(payload, boosted.briefs, { snapshotId: `${hour}|${phrase}` });
        if (payload.poiCompare) recordIndustryHour(payload.poiCompare, hour);
        snapped.push(phrase);
      } catch {
        skipped.push(phrase);
      }
    }),
  );

  const store = trendStore();
  return {
    backend: store.backend,
    configured: Boolean(readTrendDbConfig()),
    fleet,
    hour,
    snapped,
    skipped,
    snapshots: await store.snapshotCount().catch(() => 0),
  };
}

export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export function requestOrigin(req: Request): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "http";
  if (host) return `${proto}://${host}`;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return "http://localhost:3001";
}
