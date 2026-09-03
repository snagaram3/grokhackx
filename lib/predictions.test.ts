import assert from "node:assert/strict";
import { test } from "node:test";
import {
  detectRiskClustering,
  generatePredictionSummary,
  predictCampaignArc,
  predictPeakTime,
  predictPlatformSpread,
} from "./predictions";
import type { SentimentReport, Topic } from "./types";

function topic(velocity: Topic["velocity"], divergence: number, scores: Partial<Record<Topic["platforms"] extends infer P ? keyof P : never, number>>): Topic {
  return {
    id: "camry",
    label: "Camry",
    velocity,
    divergence,
    tickers: [],
    platforms: {
      x: { score: scores.x ?? 0, posts: [] },
      reddit: { score: scores.reddit ?? 0, posts: [] },
      hn: { score: scores.hn ?? 0, posts: [] },
      public: { score: scores.public ?? 0, posts: [] },
    },
  };
}

function sentiment(risk: number, neg: number, n: number): SentimentReport {
  return {
    topicId: "camry",
    lean: neg > risk ? "neg" : "mixed",
    overall: { pos: 0, neg, risk, n },
    byPlatform: {},
    drivers: [],
    quotes: [],
    hits: [],
    thin: n < 2,
  };
}

test("predictPeakTime maps velocity to phase without needing a clock for peaked/faded prints", () => {
  const peak = predictPeakTime(topic("peaking", 0.5, { hn: 80 }));
  assert.equal(peak.currentPhase, "at-peak");
  assert.equal(peak.hoursUntilPeak, 0);
  assert.equal(peak.predictedPeakTime, null);

  const fade = predictPeakTime(topic("fading", 0.5, { hn: 40 }));
  assert.equal(fade.currentPhase, "post-peak");
  assert.equal(fade.hoursUntilPeak, null);

  const bubble = predictPeakTime(topic("rising", 0.8, { hn: 90 }));
  const spread = predictPeakTime(topic("rising", 0.2, { hn: 90, reddit: 40, public: 20 }));
  assert.equal(bubble.currentPhase, "pre-peak");
  assert.ok(bubble.hoursUntilPeak != null && spread.hoursUntilPeak != null);
  assert.ok(bubble.hoursUntilPeak < spread.hoursUntilPeak);
});

test("predictPlatformSpread keeps probabilities in (0,1] and ranks inactive platforms", () => {
  const rising = predictPlatformSpread(topic("rising", 0.2, { hn: 90 }));
  assert.ok(rising.willSpreadTo.length >= 1);
  assert.ok(rising.willSpreadTo.every((p) => p.probability >= 0.05 && p.probability <= 0.95));
  assert.ok(!rising.willSpreadTo.some((p) => p.platform === "hn"));
  const ordered = rising.willSpreadTo.map((p) => p.probability);
  assert.deepEqual(ordered, [...ordered].toSorted((a, b) => b - a));

  const bubble = predictPlatformSpread(topic("fading", 0.8, { x: 20 }));
  assert.match(bubble.reasoning, /bubble|Low spread/i);
});

test("predictCampaignArc shortens news peaks and single-platform bubbles", () => {
  const news = predictCampaignArc(topic("rising", 0.7, { x: 40 }), {
    topicId: "camry",
    whyTrending: "",
    confidence: 0.4,
    category: "news",
    artifacts: [],
    audiences: [],
    campaign: { angle: "", forCompetitors: "", risk: "low", timing: "rising", hook: "" },
    causation: {
      topicId: "camry",
      firstAt: null,
      firstPlatform: null,
      lagHours: null,
      peakAt: null,
      drivers: [],
      thin: true,
    },
    sentiment: sentiment(0, 0, 0),
  });
  assert.equal(news.currentPhase, "rise");
  assert.equal(news.arcCurve[0]?.phase, "rise");
  assert.equal(news.arcCurve[0]?.durationHours, 24);
  assert.equal(news.arcCurve[1]?.durationHours, 48);

  const fade = predictCampaignArc(topic("fading", 0.3, { public: 20 }));
  assert.equal(fade.currentPhase, "fade");
  assert.deepEqual(fade.arcCurve.map((c) => c.phase), ["fade"]);
});

test("detectRiskClustering flags clustered risk words and stays low on clean titles", () => {
  const hot = detectRiskClustering(topic("rising", 0.4, { public: 10 }), sentiment(4, 2, 8));
  assert.equal(hot.clustering, true);
  assert.equal(hot.level, "high");
  assert.equal(hot.riskRatio, 0.5);

  const mid = detectRiskClustering(topic("peaking", 0.4, { public: 10 }), sentiment(1, 5, 10));
  assert.equal(mid.level, "medium");
  assert.equal(mid.clustering, false);

  const calm = detectRiskClustering(topic("peaking", 0.4, { public: 10 }), sentiment(0, 0, 10));
  assert.equal(calm.level, "low");
  assert.ok(calm.recommendations[0]?.includes("normal"));
});

test("generatePredictionSummary stays recap-only after peak", () => {
  const faded = generatePredictionSummary(topic("fading", 0.4, { hn: 20 }));
  assert.match(faded.headline, /Fading/);
  assert.match(faded.nextAction, /recap/i);
  const peaked = generatePredictionSummary(topic("peaking", 0.8, { hn: 80 }));
  assert.match(peaked.headline, /peak/i);
});
