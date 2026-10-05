import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { GET as trendsGet } from "../app/api/trends/route";
import { cachePeek, cacheSet } from "./cache";
import { trendsCacheKey } from "./geo";
import type { TrendsPayload } from "./types";

const TTL_MS = 15 * 60 * 1000;

function emptySlice() {
  return { score: 0, posts: [] as TrendsPayload["topics"][0]["platforms"]["public"]["posts"] };
}

function tape(id: string, extra: Partial<TrendsPayload> = {}): TrendsPayload {
  return {
    topics: [
      {
        id,
        label: id,
        velocity: "rising",
        divergence: 0.2,
        tickers: [],
        platforms: {
          x: emptySlice(),
          reddit: emptySlice(),
          hn: emptySlice(),
          public: { score: 10, posts: [] },
        },
      },
    ],
    updatedAt: extra.updatedAt ?? "2026-10-05T10:00:00.000Z",
    sources: { x: false, reddit: false, hn: false, public: true },
    degraded: [],
    plugged: extra.plugged,
    ...extra,
  };
}

test("trends GET leftover cache hit returns the seeded tape and does not live-collect", async () => {
  const key = trendsCacheKey("tokyo", "CoverageCacheCamryZz");
  const seeded = tape("coverage-cache-camry", {
    plugged: "CoverageCacheCamryZz",
    updatedAt: "2026-10-05T10:00:00.000Z",
    pipeline: "seeded leftover cache",
  });
  const prev = cachePeek<TrendsPayload>(key);
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    throw new Error(`cache miss hit live collect: ${String(input)}`);
  }) as typeof fetch;
  cacheSet(key, seeded);
  try {
    const res = await trendsGet(
      new NextRequest("http://localhost/api/trends?city=tokyo&topic=CoverageCacheCamryZz"),
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as TrendsPayload;
    assert.equal(body.updatedAt, "2026-10-05T10:00:00.000Z");
    assert.equal(body.plugged, "CoverageCacheCamryZz");
    assert.equal(body.pipeline, "seeded leftover cache");
    assert.equal(body.topics[0]?.id, "coverage-cache-camry");
  } finally {
    globalThis.fetch = orig;
    if (prev) cacheSet(key, prev);
  }
});

test("trends GET leftover expired peek still returns the last tape instead of inventing a collect", async () => {
  const key = trendsCacheKey("nairobi", "CoverageStaleCamryZz");
  const seeded = tape("coverage-stale-camry", {
    plugged: "CoverageStaleCamryZz",
    updatedAt: "2026-10-05T09:00:00.000Z",
    pipeline: "seeded leftover stale",
  });
  const prev = cachePeek<TrendsPayload>(key);
  const orig = globalThis.fetch;
  const realNow = Date.now;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    throw new Error(`stale miss hit live collect: ${String(input)}`);
  }) as typeof fetch;
  try {
    Date.now = () => 2_000;
    cacheSet(key, seeded);
    Date.now = () => 2_000 + TTL_MS + 1;
    const res = await trendsGet(
      new NextRequest("http://localhost/api/trends?city=nairobi&topic=CoverageStaleCamryZz"),
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as TrendsPayload;
    assert.equal(body.pipeline, "seeded leftover stale");
    assert.equal(body.updatedAt, "2026-10-05T09:00:00.000Z");
    assert.equal(body.topics[0]?.id, "coverage-stale-camry");
  } finally {
    Date.now = realNow;
    globalThis.fetch = orig;
    if (prev) cacheSet(key, prev);
  }
});
