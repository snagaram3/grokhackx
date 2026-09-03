import assert from "node:assert/strict";
import { test } from "node:test";
import { briefFilename, formatKeepBrief, lensCaption, takeawayFor } from "./brief";
import type { BoosterTopicBrief, Post, Topic } from "./types";

function emptySlice() {
  return { score: 0, posts: [] as Post[] };
}

function topic(): Topic {
  return {
    id: "camry",
    label: "Camry",
    velocity: "rising",
    divergence: 0.4,
    tickers: [],
    platforms: {
      x: emptySlice(),
      reddit: emptySlice(),
      hn: emptySlice(),
      public: {
        score: 10,
        posts: [
          {
            platform: "public",
            title: "Toyota Camry",
            url: "https://en.wikipedia.org/wiki/Toyota_Camry",
            score: 10,
            createdAt: "2026-08-26T12:00:00.000Z",
            tool: "collect_wikipedia",
            collectedAt: "2026-08-26T12:00:00.000Z",
          },
        ],
      },
    },
  };
}

function brief(extra: Partial<BoosterTopicBrief> = {}): BoosterTopicBrief {
  return {
    topicId: "camry",
    whyTrending: "Rising from Wikipedia and NHTSA receipts.",
    confidence: 0.42,
    category: "markets",
    artifacts: [{ kind: "hashtag", value: "#Camry", mentions: 1, platforms: ["public"] }],
    audiences: [
      { lens: "kids", label: "Family", takeaway: "Don't scan unknown QR codes without a parent." },
      { lens: "gen-z", label: "18–24", takeaway: "Only jump in with a real point of view." },
    ],
    campaign: {
      angle: "Sell the job underneath",
      forCompetitors: "Answer the job behind Camry.",
      risk: "low",
      timing: "rising",
      hook: "Rising — lead with a proof point, not a slogan.",
    },
    causation: {
      topicId: "camry",
      firstAt: "2026-08-26T12:00:00.000Z",
      firstPlatform: "public",
      lagHours: null,
      peakAt: null,
      drivers: [],
      thin: true,
    },
    sentiment: {
      topicId: "camry",
      lean: "thin",
      overall: { pos: 0, neg: 0, risk: 0, n: 1 },
      byPlatform: {},
      drivers: [],
      quotes: ["Toyota Camry"],
      hits: [],
      thin: true,
    },
    ...extra,
  };
}

test("briefFilename slugs labels and formatKeepBrief never invents a cause", () => {
  assert.equal(briefFilename("Toyota Camry!!"), "hawkxai-brief-toyota-camry.md");
  assert.equal(briefFilename("   "), "hawkxai-brief-topic.md");

  const packed = brief();
  const md = formatKeepBrief({
    topic: topic(),
    brief: packed,
    query: {
      raw: "Camry",
      kind: "product",
      category: "markets",
      aliases: ["Toyota Camry"],
      search: "Camry",
      match: "exact",
      hitCount: 1,
      floor: "Exact print for Camry.",
    },
    lens: "kids",
    since: ["+1 Wikipedia receipt"],
  });
  assert.match(md, /Exact print for Camry/);
  assert.match(md, /Since last look/);
  assert.match(md, /\+1 Wikipedia receipt/);
  assert.match(md, /Don't scan unknown QR codes/);
  assert.match(md, /Thin — not enough titled receipts/);
  assert.match(md, /Receipts are thin — do not treat this as a cause/);
  assert.match(md, /Evidence only\. Nothing here is an invented cause/);
  assert.match(md, /Toyota Camry/);
});

test("takeawayFor and lensCaption use the campaign hook for All", () => {
  const packed = brief();
  assert.equal(takeawayFor(packed, "all"), undefined);
  assert.equal(lensCaption(packed, "all"), packed.campaign.hook);
  assert.equal(takeawayFor(packed, "kids")?.label, "Family");
  assert.equal(lensCaption(undefined, "kids"), undefined);
});
