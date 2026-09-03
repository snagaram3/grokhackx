import assert from "node:assert/strict";
import { test } from "node:test";
import { inferQueryIntent, toQueryInsight } from "./query";
import type { SentimentReport, Topic } from "./types";

function emptySlice() {
  return { score: 0, posts: [] as Topic["platforms"]["public"]["posts"] };
}

function topic(
  label: string,
  posts: { title: string; url: string }[],
  match?: Topic["match"],
): Topic {
  const publicPosts = posts.map((p) => ({
    platform: "public" as const,
    title: p.title,
    url: p.url,
    score: 10,
    createdAt: "2026-08-29T00:00:00.000Z",
  }));
  return {
    id: label.toLowerCase(),
    label,
    velocity: "rising",
    divergence: 0.2,
    tickers: [],
    match,
    platforms: {
      x: emptySlice(),
      reddit: emptySlice(),
      hn: emptySlice(),
      public: { score: publicPosts.length * 10, posts: publicPosts },
    },
  };
}

function sentiment(partial: Partial<SentimentReport> = {}): SentimentReport {
  return {
    topicId: "camry",
    lean: "pos",
    overall: { pos: 4, neg: 1, risk: 0, n: 5 },
    byPlatform: {},
    drivers: [],
    quotes: [],
    hits: [],
    thin: false,
    ...partial,
  };
}

test("toQueryInsight with no topics is a neighbor miss, not an invented exact hit", () => {
  const intent = inferQueryIntent("Camry");
  const insight = toQueryInsight(intent, [], null);
  assert.equal(insight.match, "neighbor");
  assert.equal(insight.hitCount, 0);
  assert.equal(insight.kind, "product");
  assert.match(insight.floor, /No exact print/);
});

test("toQueryInsight counts receipts and keeps the topic match", () => {
  const intent = inferQueryIntent("Camry");
  const exact = toQueryInsight(
    intent,
    [
      topic(
        "Camry",
        [
          { title: "Toyota Camry recall", url: "https://nhtsa.test/1" },
          { title: "Camry hybrid", url: "https://news.test/2" },
        ],
        "exact",
      ),
    ],
    sentiment(),
  );
  assert.equal(exact.match, "exact");
  assert.equal(exact.hitCount, 2);
  assert.match(exact.floor, /positive/);

  const near = toQueryInsight(intent, [topic("Camry", [{ title: "Camry", url: "https://a.test/1" }], "near")], null);
  assert.equal(near.match, "near");
  assert.match(near.floor, /Not an exact match/);

  const thin = toQueryInsight(
    intent,
    [topic("Camry", [{ title: "Camry", url: "https://a.test/1" }], "exact")],
    sentiment({ thin: true, lean: "thin" }),
  );
  assert.match(thin.floor, /thin/);
});
