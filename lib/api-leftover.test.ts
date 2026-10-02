import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { GET as publicApisGet } from "../app/api/public-apis/route";
import { POST as askPost } from "../app/api/ask/route";
import { GET as boosterGet } from "../app/api/booster/route";
import { GET as collectGet } from "../app/api/collect/route";
import { GET as fleetGet, POST as fleetPost } from "../app/api/fleet/route";
import { GET as rlGet, POST as rlPost } from "../app/api/rl/route";
import { GET as watchGet, PATCH as watchPatch, POST as watchPost, DELETE as watchDelete } from "../app/api/watchlist/route";
import { cachePeek, cacheSet } from "./cache";
import { trendsCacheKey } from "./geo";
import type { BoosterPayload, LeafForecast, TrendsPayload } from "./types";

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

function geminiEnvelope(text: string): Response {
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
    text: async () => "",
  } as Response;
}

function forecast(topicId: string): LeafForecast {
  return {
    leafId: `topic:${topicId}`,
    topicId,
    category: "markets",
    kind: "topic",
    outlook: "rising",
    sentimentLean: "thin",
    confidence: 0.4,
    analysis: "cached leftover forecast",
    evidence: "test",
    thin: false,
  };
}

test("ask POST extracts wrapped Gemini JSON and drops topic ids that are not on the tape", async () => {
  cacheSet(trendsCacheKey("all"), tape(["camry", "tesla"]));
  const orig = globalThis.fetch;
  globalThis.fetch = (async () =>
    geminiEnvelope(
      'Sure.\n{"answer":"Camry is on the tape.","topicIds":["camry","ghost"]}',
    )) as typeof fetch;
  try {
    await withEnv("GOOGLE_API_KEY", "coverage-ask-wrap-key", async () => {
      await withEnv("GEMINI_API_KEY", undefined, async () => {
        const res = await askPost(jsonReq("http://localhost/api/ask", { q: "Camry" }));
        assert.equal(res.status, 200);
        const body = (await res.json()) as { answer?: string; topicIds?: string[] };
        assert.equal(body.answer, "Camry is on the tape.");
        assert.deepEqual(body.topicIds, ["camry"]);
      });
    });
  } finally {
    globalThis.fetch = orig;
  }
});

test("ask POST unwraps fenced Gemini JSON and still filters invented topic ids", async () => {
  cacheSet(trendsCacheKey("all"), tape(["camry", "tesla"]));
  const orig = globalThis.fetch;
  globalThis.fetch = (async () =>
    geminiEnvelope(
      '```json\n{"answer":"Camry stays on the map.","topicIds":["camry","invented"]}\n```',
    )) as typeof fetch;
  try {
    await withEnv("GOOGLE_API_KEY", "coverage-ask-fence-key", async () => {
      await withEnv("GEMINI_API_KEY", undefined, async () => {
        const res = await askPost(jsonReq("http://localhost/api/ask", { q: "Camry" }));
        assert.equal(res.status, 200);
        const body = (await res.json()) as { answer?: string; topicIds?: string[] };
        assert.equal(body.answer, "Camry stays on the map.");
        assert.deepEqual(body.topicIds, ["camry"]);
      });
    });
  } finally {
    globalThis.fetch = orig;
  }
});

test("booster GET reuses a matching cached brief and does not invent a new tape stamp", async () => {
  const trends = tape(["camry"], { updatedAt: "2026-10-02T10:00:00.000Z" });
  const cached: BoosterPayload = {
    updatedAt: "2026-10-02T10:00:00.000Z",
    sourceUpdatedAt: trends.updatedAt,
    summary: "cached leftover booster",
    briefs: [],
    improvisations: [],
    forecasts: [forecast("camry")],
  };
  const prevTrends = cachePeek<TrendsPayload>("trends:v1");
  const prevBooster = cachePeek<BoosterPayload>("booster:v1");
  cacheSet("trends:v1", trends);
  cacheSet("booster:v1", cached);
  try {
    const res = await boosterGet();
    assert.equal(res.status, 200);
    const body = (await res.json()) as BoosterPayload;
    assert.equal(body.summary, "cached leftover booster");
    assert.equal(body.sourceUpdatedAt, trends.updatedAt);
    assert.equal(body.forecasts?.[0]?.analysis, "cached leftover forecast");
  } finally {
    if (prevTrends) cacheSet("trends:v1", prevTrends);
    if (prevBooster) cacheSet("booster:v1", prevBooster);
  }
});

test("booster GET with a fresh tape returns briefs instead of 409", async () => {
  const trends = tape(["camry"], { updatedAt: "2026-10-02T10:05:00.000Z" });
  const prevTrends = cachePeek<TrendsPayload>("trends:v1");
  const prevBooster = cachePeek<BoosterPayload>("booster:v1");
  cacheSet("trends:v1", trends);
  cacheSet("booster:v1", {
    updatedAt: "2026-01-01T00:00:00.000Z",
    sourceUpdatedAt: "stale",
    summary: "stale leftover booster",
    briefs: [],
    improvisations: [],
  });
  try {
    const res = await boosterGet();
    assert.equal(res.status, 200);
    const body = (await res.json()) as BoosterPayload;
    assert.equal(body.sourceUpdatedAt, trends.updatedAt);
    assert.notEqual(body.summary, "stale leftover booster");
    assert.ok(Array.isArray(body.briefs));
    assert.ok(Array.isArray(body.forecasts));
  } finally {
    if (prevTrends) cacheSet("trends:v1", prevTrends);
    if (prevBooster) cacheSet("booster:v1", prevBooster);
  }
});

test("watchlist GET is memory, PATCH ignore lands, and an unknown entity stays ok with no insight", async () => {
  await withEnv("TREND_DB_HOST", undefined, async () => {
    await withEnv("TREND_DB_USER", undefined, async () => {
      const listed = await watchGet();
      assert.equal(listed.status, 200);
      const listedBody = (await listed.json()) as { backend?: string; insights?: unknown[] };
      assert.equal(listedBody.backend, "memory");
      assert.ok(Array.isArray(listedBody.insights));

      const created = await watchPost(
        jsonReq("http://localhost/api/watchlist", { label: "Coverage Patch Camry Zz" }),
      );
      assert.equal(created.status, 200);
      const createdBody = (await created.json()) as { entity?: { id: string } };
      const id = createdBody.entity?.id;
      assert.ok(id);

      try {
        const ignored = await watchPatch(
          jsonReq(
            "http://localhost/api/watchlist",
            {
              entityId: id,
              url: "https://en.wikipedia.org/wiki/Camry",
              tag: "ignore",
            },
            "PATCH",
          ),
        );
        assert.equal(ignored.status, 200);
        const ignoredBody = (await ignored.json()) as { ok?: boolean; insight?: { goldTags?: number } | null };
        assert.equal(ignoredBody.ok, true);
        assert.ok(ignoredBody.insight);

        const missing = await watchPatch(
          jsonReq(
            "http://localhost/api/watchlist",
            {
              entityId: "coverage-missing-entity-zz",
              url: "https://en.wikipedia.org/wiki/Camry",
              tag: "official",
            },
            "PATCH",
          ),
        );
        assert.equal(missing.status, 200);
        const missingBody = (await missing.json()) as { ok?: boolean; insight?: unknown };
        assert.equal(missingBody.ok, true);
        assert.equal(missingBody.insight, null);
      } finally {
        await watchDelete(new NextRequest(`http://localhost/api/watchlist?id=${encodeURIComponent(id)}`));
      }
    });
  });
});

test("rl GET lists arms and POST clamps a numeric reward to [0, 1]", async () => {
  const listed = await rlGet();
  assert.equal(listed.status, 200);
  const listedBody = (await listed.json()) as { arms?: { name: string }[] };
  assert.ok(Array.isArray(listedBody.arms));

  const high = `coverage-rl-high-${Date.now()}`;
  const low = `coverage-rl-low-${Date.now()}`;
  const highRes = await rlPost(jsonReq("http://localhost/api/rl", { feed: high, reward: 1.5 }));
  assert.equal(highRes.status, 200);
  const highBody = (await highRes.json()) as { arms?: { name: string; reward: number }[] };
  assert.equal(highBody.arms?.[0]?.name, high);
  assert.equal(highBody.arms?.[0]?.reward, 1);

  const lowRes = await rlPost(jsonReq("http://localhost/api/rl", { feeds: [low], reward: -2 }));
  assert.equal(lowRes.status, 200);
  const lowBody = (await lowRes.json()) as { arms?: { name: string; reward: number }[] };
  assert.equal(lowBody.arms?.[0]?.name, low);
  assert.equal(lowBody.arms?.[0]?.reward, 0);
});

test("fleet GET reports unset vs mocked health without leaking the URL", async () => {
  await withEnv("FLEET_URL", undefined, async () => {
    const unset = await fleetGet();
    assert.equal(unset.status, 200);
    const unsetBody = (await unset.json()) as { configured?: boolean; ok?: boolean; url?: string };
    assert.equal(unsetBody.configured, false);
    assert.equal(unsetBody.ok, false);
    assert.equal(unsetBody.url, undefined);
  });

  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    assert.match(url, /\/health$/);
    return { ok: true } as Response;
  }) as typeof fetch;
  try {
    await withEnv("FLEET_URL", "https://fleet.example/", async () => {
      const live = await fleetGet();
      assert.equal(live.status, 200);
      const body = (await live.json()) as { configured?: boolean; ok?: boolean; url?: string };
      assert.equal(body.configured, true);
      assert.equal(body.ok, true);
      assert.equal(body.url, undefined);
    });
  } finally {
    globalThis.fetch = orig;
  }
});

test("fleet POST keeps titled public/hn posts and drops unknown platforms or blank titles", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = (async () =>
    ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          agent: "hawkxai_ingest",
          tools: ["collect_nhtsa"],
          uri: "gs://snap/camry",
          posts: [
            {
              platform: "public",
              title: "Camry recall",
              url: "https://nhtsa.test/camry",
              score: "12",
              createdAt: "2026-08-26T12:00:00Z",
              sourceApi: "NHTSA",
            },
            { platform: "irc", title: "drop me", url: "https://x.test/1" },
            { platform: "public", title: "  ", url: "https://x.test/2" },
            {
              platform: "hn",
              title: "Camry thread",
              url: "https://hn.test/1",
              score: 8,
              createdAt: "2026-08-26T13:00:00Z",
            },
          ],
        }),
    }) as Response) as typeof fetch;
  try {
    await withEnv("FLEET_URL", "https://fleet.example", async () => {
      const res = await fleetPost(jsonReq("http://localhost/api/fleet", { phrase: "Camry" }));
      assert.equal(res.status, 200);
      const body = (await res.json()) as {
        plugged?: string;
        topics?: { platforms: TrendsPayload["topics"][0]["platforms"] }[];
        publicApis?: { sources?: string[] };
        sources?: { hn?: boolean; public?: boolean };
        pipeline?: string;
      };
      assert.equal(body.plugged, "Camry");
      assert.equal(body.sources?.hn, true);
      assert.equal(body.sources?.public, true);
      assert.ok(body.publicApis?.sources?.includes("NHTSA"));
      assert.match(body.pipeline ?? "", /fleet ADK hawkxai_ingest/);
      const titles = (body.topics ?? []).flatMap((t) =>
        ["public", "hn", "x", "reddit"].flatMap((p) =>
          (t.platforms[p as keyof typeof t.platforms]?.posts ?? []).map((post) => post.title),
        ),
      );
      assert.ok(titles.includes("Camry recall"));
      assert.ok(titles.includes("Camry thread"));
      assert.equal(titles.includes("drop me"), false);
    });
  } finally {
    globalThis.fetch = orig;
  }
});

test("collect GET with a cached tape returns forecasts instead of waiting", async () => {
  const prev = cachePeek<TrendsPayload>("trends:v1");
  cacheSet("trends:v1", tape(["camry"], { updatedAt: "2026-10-02T10:10:00.000Z" }));
  try {
    const res = await collectGet(new NextRequest("http://localhost/api/collect"));
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      waiting?: string;
      forecasts?: unknown[];
      category?: string;
      backend?: string;
    };
    assert.equal(body.waiting, undefined);
    assert.equal(body.category, "all");
    assert.equal(body.backend, "memory");
    assert.ok(Array.isArray(body.forecasts));
  } finally {
    if (prev) cacheSet("trends:v1", prev);
  }
});

test("public-apis GET keeps no-auth HTTPS rows and maps catalog fetch failure to 502", async () => {
  const orig = globalThis.fetch;
  try {
    globalThis.fetch = (async () => {
      throw new Error("catalog offline");
    }) as typeof fetch;
    const failed = await publicApisGet();
    assert.equal(failed.status, 502);
    const failedBody = (await failed.json()) as { error?: string };
    assert.match(failedBody.error ?? "", /catalog offline/);

    globalThis.fetch = (async () =>
      ({
        ok: true,
        text: async () => `
### Vehicles
| API | Description | Auth | HTTPS | CORS |
| [Open NHTSA](https://nhtsa.test) | recalls | No | Yes | Yes |
| [Keyed Feed](https://key.test) | paid | apiKey | Yes | Yes |
| [Plain HTTP](http://plain.test) | old | No | No | Yes |
| [None Auth](https://none.test) | open | None | Yes | Unknown |
`,
      }) as Response) as typeof fetch;
    const ok = await publicApisGet();
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as {
      catalog?: number;
      noAuthHttps?: number;
      entries?: { name: string }[];
    };
    assert.equal(body.catalog, 4);
    assert.equal(body.noAuthHttps, 2);
    assert.deepEqual(
      (body.entries ?? []).map((e) => e.name).toSorted(),
      ["None Auth", "Open NHTSA"],
    );
  } finally {
    globalThis.fetch = orig;
  }
});
