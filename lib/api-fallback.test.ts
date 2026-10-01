import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { POST as askPost } from "../app/api/ask/route";
import { POST as fleetPost } from "../app/api/fleet/route";
import { POST as rlPost } from "../app/api/rl/route";
import { GET as tapeGet, PUT as tapePut } from "../app/api/tape-watch/route";
import { DELETE as watchDelete, POST as watchPost } from "../app/api/watchlist/route";
import { cacheSet } from "./cache";
import { trendsCacheKey } from "./geo";
import { loadTapeWatch, saveTapeWatch } from "./watchlist-store";
import type { TrendsPayload } from "./types";

function jsonReq(url: string, body: unknown, method = "POST"): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function emptySlice() {
  return { score: 0, posts: [] as TrendsPayload["topics"][0]["platforms"]["public"]["posts"] };
}

function tape(ids: string[]): TrendsPayload {
  return {
    topics: ids.map((id) => ({
      id,
      label: id,
      velocity: "rising" as const,
      divergence: 0.2,
      tickers: [],
      platforms: { x: emptySlice(), reddit: emptySlice(), hn: emptySlice(), public: { score: 10, posts: [] } },
    })),
    updatedAt: "2026-08-26T12:00:00.000Z",
    sources: { x: false, reddit: false, hn: false, public: true },
    degraded: [],
  };
}

function withEnv(key: string, value: string | undefined, fn: () => Promise<void> | void) {
  const prev = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  const restore = () => {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  };
  try {
    const out = fn();
    if (out && typeof (out as Promise<void>).then === "function") {
      return (out as Promise<void>).finally(restore);
    }
  } catch (err) {
    restore();
    throw err;
  }
  restore();
}

async function errorOf(res: Response): Promise<string> {
  const body = (await res.json()) as { error?: string };
  return body.error ?? "";
}

test("ask POST is map-only when a city tape is cached and Gemini is offline", async () => {
  await withEnv("GOOGLE_API_KEY", undefined, async () => {
    await withEnv("GEMINI_API_KEY", undefined, async () => {
      cacheSet(trendsCacheKey("all"), tape(["camry", "tesla", "civic", "accord"]));
      const res = await askPost(jsonReq("http://localhost/api/ask", { q: "Camry" }));
      assert.equal(res.status, 200);
      const body = (await res.json()) as { answer?: string; topicIds?: string[] };
      assert.match(body.answer ?? "", /Gemini is offline/);
      assert.deepEqual(body.topicIds, ["camry", "tesla", "civic"]);
    });
  });
});

test("ask POST uses the city cache key, then falls back to the world tape", async () => {
  await withEnv("GOOGLE_API_KEY", undefined, async () => {
    await withEnv("GEMINI_API_KEY", undefined, async () => {
      cacheSet(trendsCacheKey("london"), tape(["london-camry"]));
      const cityHit = await askPost(
        jsonReq("http://localhost/api/ask", { q: "Camry", city: "London" }),
      );
      assert.equal(cityHit.status, 200);
      const cityBody = (await cityHit.json()) as { topicIds?: string[] };
      assert.deepEqual(cityBody.topicIds, ["london-camry"]);

      cacheSet("trends:v1", tape(["world-camry"]));
      const fallback = await askPost(
        jsonReq("http://localhost/api/ask", { q: "Camry", city: "Tokyo" }),
      );
      assert.equal(fallback.status, 200);
      const fallbackBody = (await fallback.json()) as { topicIds?: string[] };
      assert.deepEqual(fallbackBody.topicIds, ["world-camry"]);
    });
  });
});

test("ask POST keeps the map unchanged when Gemini returns no JSON object", async () => {
  cacheSet(trendsCacheKey("all"), tape(["camry", "tesla"]));
  const orig = globalThis.fetch;
  globalThis.fetch = (async () =>
    ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "not-json" }] } }] }),
      text: async () => "",
    }) as Response) as typeof fetch;
  try {
    await withEnv("GOOGLE_API_KEY", "coverage-ask-key", async () => {
      await withEnv("GEMINI_API_KEY", undefined, async () => {
        const res = await askPost(jsonReq("http://localhost/api/ask", { q: "Camry" }));
        assert.equal(res.status, 200);
        const body = (await res.json()) as { answer?: string; topicIds?: string[] };
        assert.match(body.answer ?? "", /Could not parse a Gemini answer/);
        assert.deepEqual(body.topicIds, []);
      });
    });
  } finally {
    globalThis.fetch = orig;
  }
});

test("fleet POST maps non-JSON and generic ingest failures to 502, and keeps 503", async () => {
  const orig = globalThis.fetch;
  try {
    await withEnv("FLEET_URL", "https://fleet.example", async () => {
      globalThis.fetch = (async () =>
        ({ ok: true, status: 200, text: async () => "snapped-not-json" }) as Response) as typeof fetch;
      const badJson = await fleetPost(jsonReq("http://localhost/api/fleet", { phrase: "Camry" }));
      assert.equal(badJson.status, 502);
      assert.match(await errorOf(badJson), /fleet returned non-JSON/);

      globalThis.fetch = (async () =>
        ({ ok: false, status: 500, text: async () => "ingest crashed" }) as Response) as typeof fetch;
      const generic = await fleetPost(jsonReq("http://localhost/api/fleet", { phrase: "Camry" }));
      assert.equal(generic.status, 502);
      assert.match(await errorOf(generic), /ingest crashed/);

      globalThis.fetch = (async () =>
        ({ ok: false, status: 503, text: async () => "fleet cold" }) as Response) as typeof fetch;
      const cold = await fleetPost(jsonReq("http://localhost/api/fleet", { phrase: "Camry" }));
      assert.equal(cold.status, 503);
      assert.match(await errorOf(cold), /fleet cold/);
    });
  } finally {
    globalThis.fetch = orig;
  }
});

test("watchlist DELETE unknown id is ok:false, and POST splits comma aliases", async () => {
  await withEnv("TREND_DB_HOST", undefined, async () => {
    await withEnv("TREND_DB_USER", undefined, async () => {
      const missing = await watchDelete(new NextRequest("http://localhost/api/watchlist?id=coverage-missing-id"));
      assert.equal(missing.status, 200);
      const missingBody = (await missing.json()) as { ok?: boolean };
      assert.equal(missingBody.ok, false);

      const created = await watchPost(
        jsonReq("http://localhost/api/watchlist", {
          label: "Coverage Alias Camry",
          aliases: "Toyota Camry, Camry Hybrid, x",
        }),
      );
      assert.equal(created.status, 200);
      const body = (await created.json()) as { entity?: { id: string; aliases: string[] } };
      assert.ok(body.entity?.aliases.includes("Toyota Camry"));
      assert.ok(body.entity?.aliases.includes("Camry Hybrid"));
      assert.equal(body.entity?.aliases.includes("x"), false);
      const removed = await watchDelete(
        new NextRequest(`http://localhost/api/watchlist?id=${encodeURIComponent(body.entity!.id)}`),
      );
      assert.equal(((await removed.json()) as { ok?: boolean }).ok, true);
    });
  });
});

test("rl POST trims a single feed and treats a non-number reward as 1", async () => {
  const name = `coverage-rl-${Date.now()}`;
  const res = await rlPost(jsonReq("http://localhost/api/rl", { feed: `  ${name}  `, reward: "0.5" }));
  assert.equal(res.status, 200);
  const body = (await res.json()) as { arms?: { name: string; reward: number; pulls: number }[] };
  assert.equal(body.arms?.[0]?.name, name);
  assert.equal(body.arms?.[0]?.reward, 1);
  assert.ok((body.arms?.[0]?.pulls ?? 0) >= 1);
});

test("tape-watch PUT garbage store stays empty instead of inventing starred ids", async () => {
  await withEnv("TREND_DB_HOST", undefined, async () => {
    await withEnv("TREND_DB_USER", undefined, async () => {
      const prev = await loadTapeWatch();
      try {
        const put = await tapePut(jsonReq("http://localhost/api/tape-watch", { foo: 1 }, "PUT"));
        assert.equal(put.status, 200);
        const saved = (await put.json()) as { ok?: boolean; store?: { ids: string[] } };
        assert.equal(saved.ok, true);
        assert.deepEqual(saved.store?.ids, []);

        const listed = await tapeGet();
        assert.equal(listed.status, 200);
        const body = (await listed.json()) as { store?: { ids: string[] }; backend?: string };
        assert.equal(body.backend, "memory");
        assert.deepEqual(body.store?.ids, []);
      } finally {
        await saveTapeWatch(prev.store);
      }
    });
  });
});
