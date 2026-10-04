import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSentiment } from "./sentiment";
import type { Post, Topic } from "./types";

function emptySlice() {
  return { score: 0, posts: [] as Post[] };
}

function topic(posts: Post[]): Topic {
  const platforms = {
    x: emptySlice(),
    reddit: emptySlice(),
    hn: emptySlice(),
    public: emptySlice(),
  };
  for (const p of posts) {
    platforms[p.platform].posts.push(p);
    platforms[p.platform].score = 10;
  }
  return {
    id: "camry",
    label: "Camry",
    velocity: "rising",
    divergence: 0.3,
    tickers: [],
    platforms,
  };
}

function post(title: string, platform: Post["platform"] = "public"): Post {
  return {
    platform,
    title,
    url: `https://a.test/${encodeURIComponent(title)}`,
    score: 10,
    createdAt: "2026-08-26T12:00:00.000Z",
  };
}

test("buildSentiment leftover empty receipts stay thin and do not invent a mood", () => {
  const report = buildSentiment(topic([]));
  assert.equal(report.thin, true);
  assert.equal(report.lean, "thin");
  assert.equal(report.overall.n, 0);
  assert.equal(report.drivers.length, 1);
  assert.equal(report.drivers[0]?.id, "sent-thin");
  assert.match(report.drivers[0]?.evidence ?? "", /No receipts — will not invent a mood/);
});

test("buildSentiment leftover controversy titles attach a sent-risk driver", () => {
  const report = buildSentiment(
    topic([post("Camry recall lawsuit"), post("Camry crash probe")]),
  );
  assert.equal(report.lean, "neg");
  assert.ok(report.overall.risk >= 2);
  const risk = report.drivers.find((d) => d.id === "sent-risk");
  assert.ok(risk);
  assert.match(risk?.evidence ?? "", /controversy hits/);
  assert.ok(report.drivers.some((d) => d.id === "sent-public"));
});

test("buildSentiment leftover platform drivers keep HN and public tone separate", () => {
  const report = buildSentiment(
    topic([post("Camry win record", "hn"), post("Camry delay", "public")]),
  );
  const hn = report.drivers.find((d) => d.id === "sent-hn");
  const pub = report.drivers.find((d) => d.id === "sent-public");
  assert.ok(hn);
  assert.match(hn?.label ?? "", /hn tone · pos/);
  assert.match(hn?.evidence ?? "", /1 titles · 2 pos \/ 0 neg/);
  assert.ok(pub);
  assert.match(pub?.label ?? "", /public tone · neg/);
  assert.match(pub?.evidence ?? "", /1 titles · 0 pos \/ 1 neg/);
  assert.equal(report.drivers.some((d) => d.id === "sent-reddit"), false);
});
