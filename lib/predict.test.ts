import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyTopic } from "./desk";
import { divergenceOf, slug, totalScore, velocityOf } from "./metrics";
import { confidenceOf, forecastNode, outlookFromScores, type HistoryPoint } from "./predict";
import { buildSentiment } from "./sentiment";
import type { MindNode, Post, Topic } from "./types";

function emptySlice() {
  return { score: 0, posts: [] as Post[] };
}

function topic(partial: Partial<Topic> & Pick<Topic, "id" | "label">): Topic {
  return {
    velocity: "peaking",
    divergence: 0.5,
    tickers: [],
    platforms: { x: emptySlice(), reddit: emptySlice(), hn: emptySlice(), public: emptySlice() },
    ...partial,
  };
}

function post(title: string, extra: Partial<Post> = {}): Post {
  return {
    platform: "public",
    title,
    url: `https://a.test/${encodeURIComponent(title)}`,
    score: 10,
    createdAt: "2026-08-26T12:00:00.000Z",
    ...extra,
  };
}

test("outlookFromScores uses 8% rise/fall and stable for non-topic leaves", () => {
  assert.equal(outlookFromScores(10, 11, "topic"), "rising");
  assert.equal(outlookFromScores(10, 9, "topic"), "fading");
  assert.equal(outlookFromScores(10, 10.5, "topic"), "peaking");
  assert.equal(outlookFromScores(10, 10.5, "artifact"), "stable");
});

test("confidenceOf abstains under two snapshots and discounts thin titles", () => {
  assert.equal(confidenceOf(1, false), 0);
  assert.equal(confidenceOf(2, false), 0.5);
  assert.equal(confidenceOf(2, true), 0.3);
  assert.equal(confidenceOf(5, false), 0.85);
  assert.equal(confidenceOf(20, false), 0.85);
});

test("forecastNode stays thin for hub and a single snapshot", () => {
  const node: MindNode = { id: "camry", kind: "topic", label: "Camry", topicId: "camry", weight: 1 };
  const hub: MindNode = { id: "hub", kind: "hub", label: "markets", weight: 1 };
  const one: HistoryPoint[] = [
    {
      at: "2026-08-26T12:00:00.000Z",
      topicId: "camry",
      label: "Camry",
      velocity: "rising",
      score: 40,
      lean: "thin",
      pos: 0,
      neg: 0,
      risk: 0,
      n: 1,
      receiptCount: 2,
      firstPlatform: "public",
      driverWeight: null,
      artifacts: [],
    },
  ];
  const thin = forecastNode(node, one, "markets");
  assert.equal(thin.thin, true);
  assert.equal(thin.outlook, "thin");
  assert.equal(thin.confidence, 0);
  assert.match(thin.analysis, /Need a second collect/);

  const hubCall = forecastNode(hub, one, "markets");
  assert.equal(hubCall.thin, true);
  assert.match(hubCall.analysis, /hub is the filter/);

  const two = [
    ...one,
    { ...one[0], at: "2026-08-26T13:00:00.000Z", score: 50, n: 4, lean: "pos" as const, pos: 3 },
  ];
  const ready = forecastNode(node, two, "markets");
  assert.equal(ready.thin, false);
  assert.equal(ready.outlook, "rising");
  assert.ok(ready.confidence > 0);
});

test("buildSentiment uses word boundaries and abstains on a single title", () => {
  const one = topic({
    id: "camry",
    label: "Camry",
    platforms: {
      x: emptySlice(),
      reddit: emptySlice(),
      hn: emptySlice(),
      public: { score: 10, posts: [post("Camry camera sensor")] },
    },
  });
  const thin = buildSentiment(one);
  assert.equal(thin.thin, true);
  assert.equal(thin.lean, "thin");
  assert.equal(thin.overall.neg, 0);

  const two = topic({
    id: "camry",
    label: "Camry",
    platforms: {
      x: emptySlice(),
      reddit: emptySlice(),
      hn: emptySlice(),
      public: {
        score: 20,
        posts: [post("Camry recall lawsuit"), post("Camry crash investigation")],
      },
    },
  });
  const neg = buildSentiment(two);
  assert.equal(neg.thin, false);
  assert.equal(neg.lean, "neg");
  assert.ok(neg.overall.neg >= 2);
  assert.ok(neg.overall.risk >= 1);
  assert.ok(neg.hits.some((h) => h.title.includes("recall")));
});

test("slug, totalScore, velocityOf, and divergenceOf stay threshold-stable", () => {
  assert.equal(slug("Toyota Camry!!"), "toyota-camry");
  assert.equal(slug("   "), "topic");
  const rising = topic({
    id: "camry",
    label: "Camry",
    platforms: {
      x: { score: 40, posts: [] },
      reddit: { score: 30, posts: [] },
      hn: { score: 21, posts: [] },
      public: { score: 9, posts: [] },
    },
  });
  assert.equal(totalScore(rising), 100);
  assert.equal(velocityOf("camry", 70), "rising");
  assert.equal(velocityOf("camry", 40), "peaking");
  assert.equal(velocityOf("camry", 120, [rising]), "rising");
  assert.equal(velocityOf("camry", 80, [rising]), "fading");
  assert.equal(velocityOf("camry", 102, [rising]), "peaking");
  assert.equal(divergenceOf(rising), 0.25);
  const bubble = topic({
    id: "hn-only",
    label: "kernel",
    platforms: {
      x: emptySlice(),
      reddit: emptySlice(),
      hn: { score: 80, posts: [] },
      public: emptySlice(),
    },
  });
  assert.equal(divergenceOf(bubble), 0.75);
});

test("classifyTopic routes QR campaigns, NWS weather, and tickers without a shared WHY", () => {
  assert.equal(
    classifyTopic(
      topic({ id: "qr", label: "#HeatWaveFit", tickers: [] }),
      [{ kind: "qr", value: "https://qrco.de/heat", mentions: 1, platforms: ["public"] }],
    ),
    "campaigns",
  );
  assert.equal(
    classifyTopic(
      topic({
        id: "storm",
        label: "Gulf storm",
        platforms: {
          x: emptySlice(),
          reddit: emptySlice(),
          hn: emptySlice(),
          public: { score: 40, posts: [post("Heat advisory", { sourceApi: "National Weather Service" })] },
        },
      }),
    ),
    "weather",
  );
  assert.equal(
    classifyTopic(topic({ id: "tsla", label: "Tesla", tickers: [{ symbol: "TSLA", sentiment: "mixed", mentions: 3 }] })),
    "markets",
  );
});
