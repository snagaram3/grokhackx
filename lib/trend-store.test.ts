import assert from "node:assert/strict";
import { test } from "node:test";
import {
  categoryOf,
  collectTape,
  historyForTopics,
  trendStore,
  wordFromTopic,
} from "./trend-store";
import type { BoosterTopicBrief, Post, Topic, TrendsPayload } from "./types";

function emptySlice() {
  return { score: 0, posts: [] as Post[] };
}

function topic(id: string, label: string, posts: Post[] = []): Topic {
  return {
    id,
    label,
    velocity: "rising",
    divergence: 0.25,
    tickers: [],
    platforms: {
      x: emptySlice(),
      reddit: emptySlice(),
      hn: emptySlice(),
      public: { score: posts.length * 10, posts },
    },
  };
}

function post(title: string): Post {
  return {
    platform: "public",
    title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    score: 10,
    createdAt: "2026-08-26T12:00:00.000Z",
  };
}

function brief(topicId: string, extra: Partial<BoosterTopicBrief> = {}): BoosterTopicBrief {
  return {
    topicId,
    whyTrending: "",
    confidence: 0.4,
    category: "markets",
    artifacts: [],
    audiences: [],
    campaign: { angle: "", forCompetitors: "", risk: "low", timing: "rising", hook: "" },
    causation: {
      topicId,
      firstAt: "2026-08-26T12:00:00.000Z",
      firstPlatform: "public",
      lagHours: null,
      peakAt: null,
      drivers: [{ id: "first-print", label: "First print -+ public", weight: 22, evidence: "wiki" }],
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
    ...extra,
  };
}

function payload(topics: Topic[], snapshotId: string): TrendsPayload {
  return {
    topics,
    updatedAt: "2026-08-26T12:00:00.000Z",
    sources: { x: false, reddit: false, hn: false, public: true },
    degraded: [],
    plugged: snapshotId,
  };
}

async function withoutTrendDb<T>(fn: () => Promise<T>): Promise<T> {
  const prev = {
    host: process.env.TREND_DB_HOST,
    user: process.env.TREND_DB_USER,
  };
  delete process.env.TREND_DB_HOST;
  delete process.env.TREND_DB_USER;
  try {
    return await fn();
  } finally {
    if (prev.host === undefined) delete process.env.TREND_DB_HOST;
    else process.env.TREND_DB_HOST = prev.host;
    if (prev.user === undefined) delete process.env.TREND_DB_USER;
    else process.env.TREND_DB_USER = prev.user;
  }
}

test("wordFromTopic and categoryOf copy receipts, not a slogan", () => {
  const camry = topic("camry-store", "Camry", [post("Camry hybrid")]);
  const point = wordFromTopic(camry, brief("camry-store"), "2026-08-26T13:00:00.000Z");
  assert.equal(point.topicId, "camry-store");
  assert.equal(point.receiptCount, 1);
  assert.equal(point.firstPlatform, "public");
  assert.equal(point.driverWeight, 22);
  assert.equal(point.at, "2026-08-26T13:00:00.000Z");
  assert.equal(categoryOf(camry), "markets");
  assert.equal(categoryOf(camry, brief("camry-store", { category: "campaigns" })), "campaigns");
});

test("memory collectTape is idempotent and replaces only when artifacts are richer", async () => {
  await withoutTrendDb(async () => {
    const store = trendStore();
    assert.equal(store.backend, "memory");
    const id = `coverage-28d9-${Date.now()}`;
    const camry = topic(id, "Camry Store", [post("Camry Store")]);
    const snap = `snap|${id}`;
    const first = await collectTape(payload([camry], id), [], { snapshotId: snap });
    assert.equal(first.store.backend, "memory");
    const once = await historyForTopics(store, "all", [id]);
    assert.equal(once.get(id)?.length, 1);
    assert.equal(once.get(id)?.[0].receiptCount, 1);
    assert.deepEqual(once.get(id)?.[0].artifacts, []);
    await collectTape(payload([camry], id), [], { snapshotId: snap });
    const twice = await historyForTopics(store, "all", [id]);
    assert.equal(twice.get(id)?.length, 1);
    const withArt = brief(id, {
      artifacts: [{ kind: "hashtag", value: "#Camry", mentions: 2, platforms: ["public"] }],
    });
    await collectTape(payload([camry], id), [withArt], { snapshotId: snap });
    const richer = await historyForTopics(store, "all", [id]);
    assert.equal(richer.get(id)?.length, 1);
    assert.equal(richer.get(id)?.[0].artifacts.length, 1);
    assert.equal(richer.get(id)?.[0].artifacts[0].value, "#Camry");
  });
});

test("wordFromTopic keeps AutoLineage tool and collectedAt on receipts", () => {
  const lineageTopic: Topic = {
    id: "camry",
    label: "Camry",
    velocity: "rising",
    divergence: 0.2,
    tickers: [],
    platforms: {
      x: emptySlice(),
      reddit: emptySlice(),
      hn: emptySlice(),
      public: {
        score: 40,
        posts: [
          {
            platform: "public",
            title: "Camry search heat",
            url: "https://trends.google.com/trending/explore?q=Camry&geo=US",
            score: 40,
            createdAt: "2026-08-31T12:00:00.000Z",
            sourceApi: "google-trends",
            tool: "collect_google_trends",
            collectedAt: "2026-08-31T12:00:01.000Z",
          },
        ],
      },
    },
  };
  const point = wordFromTopic(lineageTopic, undefined, "2026-08-31T12:00:02.000Z");
  assert.equal(point.receiptCount, 1);
  assert.equal(point.receipts?.[0].tool, "collect_google_trends");
  assert.equal(point.receipts?.[0].collectedAt, "2026-08-31T12:00:01.000Z");
  assert.equal(point.receipts?.[0].sourceApi, "google-trends");
});
