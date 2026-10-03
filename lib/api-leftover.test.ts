import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { POST as askPost } from "../app/api/ask/route";
import { GET as collectGet } from "../app/api/collect/route";
import { GET as tapeGet, PUT as tapePut } from "../app/api/tape-watch/route";
import { DELETE as watchDelete, POST as watchPost } from "../app/api/watchlist/route";
import { cachePeek, cacheSet } from "./cache";
import { trendsCacheKey } from "./geo";
import { runHourlyCollect } from "./hourly-collect";
import type { TrendsPayload } from "./types";
import { loadTapeWatch, saveTapeWatch } from "./watchlist-store";

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

function tape(ids: string[], extra: Partial<TrendsPayload> = {}): TrendsPayload {
  return {
    topics: ids.map((id) => ({
      id,
      label: id,
      velocity: "rising" as const,
      divergence: 0.2,
      tickers: [],
      platforms: { x: emptySlice(), reddit: emptySlice(), hn: emptySlice(), public: { score: 10, posts: [] } },
    })),
    updatedAt: extra.updatedAt ?? "2026-08-26T12:00:00.000Z",
    sources: { x: false, reddit: false, hn: false, public: true },
    degraded: [],
    ...extra,
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

test("ask POST with JSON that fails the answer schema keeps the map and drops topic ids", async () => {
  cacheSet(trendsCacheKey("all"), tape(["camry"]));
  const orig = globalThis.fetch;
  globalThis.fetch = (async () =>
    ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"answer":12,"topicIds":["camry"]}' }] } }],
      }),
      text: async () => "",
    }) as Response) as typeof fetch;
  try {
    await withEnv("GOOGLE_API_KEY", "coverage-ask-zod-key", async () => {
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

test("tape-watch PUT keeps a valid store and GET reports memory when TREND_DB is unset", async () => {
  await withEnv("TREND_DB_HOST", undefined, async () => {
    await withEnv("TREND_DB_USER", undefined, async () => {
      const prior = await loadTapeWatch();
      try {
        const put = await tapePut(
          jsonReq(
            "http://localhost/api/tape-watch",
            { store: { ids: ["camry"], snaps: {} } },
            "PUT",
          ),
        );
        assert.equal(put.status, 200);
        const putBody = (await put.json()) as { ok?: boolean; backend?: string; store?: { ids?: string[] } };
        assert.equal(putBody.ok, true);
        assert.equal(putBody.backend, "memory");
        assert.deepEqual(putBody.store?.ids, ["camry"]);

        const listed = await tapeGet();
        assert.equal(listed.status, 200);
        const listedBody = (await listed.json()) as { backend?: string; store?: { ids?: string[] } };
        assert.equal(listedBody.backend, "memory");
        assert.deepEqual(listedBody.store?.ids, ["camry"]);
      } finally {
        await saveTapeWatch(prior.store);
      }
    });
  });
});

test("watchlist POST keeps array aliases and drops crumb tokens", async () => {
  await withEnv("TREND_DB_HOST", undefined, async () => {
    await withEnv("TREND_DB_USER", undefined, async () => {
      const created = await watchPost(
        jsonReq("http://localhost/api/watchlist", {
          label: "Coverage Array Camry Zz",
          aliases: ["Toyota Camry", "x", "  ", "camry-hybrid"],
        }),
      );
      assert.equal(created.status, 200);
      const body = (await created.json()) as { entity?: { id: string; aliases: string[] } };
      const id = body.entity?.id;
      assert.ok(id);
      try {
        assert.ok(body.entity?.aliases.includes("Toyota Camry"));
        assert.ok(body.entity?.aliases.includes("camry-hybrid"));
        assert.equal(body.entity?.aliases.includes("x"), false);
      } finally {
        await watchDelete(new NextRequest(`http://localhost/api/watchlist?id=${encodeURIComponent(id)}`));
      }
    });
  });
});

test("hourly collect skips a watchlist phrase when lookup throws and does not invent a snap", async () => {
  await withEnv("TREND_DB_HOST", undefined, async () => {
    await withEnv("TREND_DB_USER", undefined, async () => {
      await withEnv("CRON_SECRET", undefined, async () => {
        await withEnv("FLEET_URL", undefined, async () => {
          const created = await watchPost(
            jsonReq("http://localhost/api/watchlist", { label: "Coverage Hourly Throw Zz" }),
          );
          assert.equal(created.status, 200);
          const createdBody = (await created.json()) as { entity?: { id: string; label: string } };
          const id = createdBody.entity?.id;
          const label = createdBody.entity?.label;
          assert.ok(id && label);
          const orig = globalThis.fetch;
          globalThis.fetch = (async () => {
            throw new Error("lookup leftover throw");
          }) as typeof fetch;
          const prevTape = cachePeek<TrendsPayload>("trends:v1");
          try {
            const unit = await runHourlyCollect("http://localhost");
            assert.ok(unit.skipped.includes(label));
            assert.equal(unit.snapped.includes(label), false);

            const hourly = await collectGet(new NextRequest("http://localhost/api/collect?hourly=1"));
            assert.equal(hourly.status, 200);
            const hourlyBody = (await hourly.json()) as { skipped?: string[]; snapped?: string[] };
            assert.ok((hourlyBody.skipped ?? []).includes(label));
            assert.equal((hourlyBody.snapped ?? []).includes(label), false);
          } finally {
            globalThis.fetch = orig;
            if (prevTape) cacheSet("trends:v1", prevTape);
            await watchDelete(new NextRequest(`http://localhost/api/watchlist?id=${encodeURIComponent(id)}`));
          }
        });
      });
    });
  });
});
