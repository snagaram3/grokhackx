import assert from "node:assert/strict";
import { test } from "node:test";
import { categoryForTape } from "./collect";
import { uniquePhrases } from "./hourly-collect";
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
