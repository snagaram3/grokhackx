import assert from "node:assert/strict";
import { test } from "node:test";
import { COLLECT_MS, categoryForTape, withTimeout } from "./collect";
import { LOOKUP_MS, lookupTape, uniquePhrases } from "./hourly-collect";
import type { BoosterTopicBrief, Topic, TrendsPayload } from "./types";

function topic(id: string, label: string, extra: Partial<Topic> = {}): Topic {
  return {
    id,
    label,
    velocity: "rising",
    divergence: 0.3,
    tickers: extra.tickers ?? [],
    platforms: {
      x: { score: 0, posts: [] },
      reddit: { score: 0, posts: [] },
      hn: { score: 0, posts: [] },
      public: { score: 10, posts: [] },
    },
    ...extra,
  };
}

function payload(topics: Topic[], extra: Partial<TrendsPayload> = {}): TrendsPayload {
  return {
    topics,
    updatedAt: "2026-08-26T12:00:00.000Z",
    sources: { x: false, reddit: false, hn: false, public: true },
    degraded: [],
    ...extra,
  };
}

function brief(topicId: string, category: BoosterTopicBrief["category"]): BoosterTopicBrief {
  return {
    topicId,
    whyTrending: "",
    confidence: 0.3,
    category,
    artifacts: [],
    audiences: [],
    campaign: { angle: "", forCompetitors: "", risk: "low", timing: "rising", hook: "" },
    causation: {
      topicId,
      firstAt: null,
      firstPlatform: null,
      lagHours: null,
      peakAt: null,
      drivers: [],
      thin: true,
    },
    sentiment: {
      topicId,
      lean: "thin",
      overall: { pos: 0, neg: 0, risk: 0, n: 0 },
      byPlatform: {},
      drivers: [],
      quotes: [],
      hits: [],
      thin: true,
    },
  };
}

test("uniquePhrases trims, case-folds, drops crumbs, and caps at four", () => {
  assert.deepEqual(uniquePhrases([null, " ", "a", "Camry", "camry", "Tesla"]), ["Camry", "Tesla"]);
  assert.deepEqual(
    uniquePhrases(["Camry", "Tesla", "Civic", "F-150", "Mustang", "Accord"]),
    ["Camry", "Tesla", "Civic", "F-150"],
  );
  assert.deepEqual(uniquePhrases(["  Civic  ", undefined, "civic"]), ["Civic"]);
});

test("categoryForTape prefers query category, then the lead brief, then classifyTopic", () => {
  assert.equal(categoryForTape(payload([]), []), "all");
  assert.equal(
    categoryForTape(
      payload([topic("camry", "Camry")], {
        query: {
          raw: "Camry",
          kind: "product",
          category: "markets",
          aliases: [],
          search: "Camry",
          match: "exact",
          hitCount: 1,
          floor: "Exact print",
        },
      }),
      [brief("camry", "culture")],
    ),
    "markets",
  );
  assert.equal(categoryForTape(payload([topic("storm", "Gulf storm")]), [brief("storm", "weather")]), "weather");
  assert.equal(
    categoryForTape(
      payload([topic("tsla", "Tesla", { tickers: [{ symbol: "TSLA", sentiment: "mixed", mentions: 2 }] })]),
      [],
    ),
    "markets",
  );
});

test("desk collect aborts at 2.5s, not hourly 25s or public-API 8s", () => {
  assert.equal(COLLECT_MS, 2_500);
  assert.equal(LOOKUP_MS, 25_000);
  assert.ok(COLLECT_MS < 8_000);
  assert.ok(COLLECT_MS < LOOKUP_MS);
  assert.ok(LOOKUP_MS > 8_000);
  assert.ok(LOOKUP_MS < 55_000);
});

test("withTimeout rejects collect timeout and still surfaces a store error", async () => {
  assert.equal(await withTimeout(Promise.resolve("snap"), 40), "snap");
  await assert.rejects(() => withTimeout(new Promise(() => {}), 20), { message: "collect timeout" });
  await assert.rejects(
    () => withTimeout(Promise.reject(new Error("postgres down")), 40),
    { message: "postgres down" },
  );
});

test("lookupTape encodes the phrase, skips cache, and parses a 200 tape", async () => {
  const orig = globalThis.fetch;
  const tape = { topics: [{ id: "camry", label: "Camry" }], plugged: "Camry" };
  try {
    let calls = 0;
    let url = "";
    let cache: RequestCache | undefined;
    let hadSignal = false;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      url = String(input);
      cache = init?.cache;
      hadSignal = init?.signal instanceof AbortSignal;
      return new Response(JSON.stringify(tape), { status: 200 });
    }) as typeof fetch;
    const got = await lookupTape("https://desk.example", "Toyota Camry");
    assert.deepEqual(got, tape);
    assert.equal(calls, 1);
    assert.equal(url, "https://desk.example/api/trends?topic=Toyota%20Camry");
    assert.equal(cache, "no-store");
    assert.equal(hadSignal, true);
  } finally {
    globalThis.fetch = orig;
  }
});

test("lookupTape !ok is null and does not invent a watchlist tape", async () => {
  const orig = globalThis.fetch;
  const invented = { topics: [{ id: "camry", label: "Camry" }], plugged: "Camry" };
  try {
    globalThis.fetch = (async () => new Response("nope", { status: 503 })) as typeof fetch;
    const down = await lookupTape("https://desk.example", "Camry");
    assert.equal(down, null);
    assert.notDeepEqual(down, invented);

    globalThis.fetch = (async () => new Response("missing", { status: 404 })) as typeof fetch;
    assert.equal(await lookupTape("https://desk.example", "Camry"), null);
  } finally {
    globalThis.fetch = orig;
  }
});
