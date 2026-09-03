import assert from "node:assert/strict";
import { test } from "node:test";
import { collectorSummary, healthFrom, validatorAgent } from "./agents";
import type { Post, Topic } from "./types";

function emptySlice() {
  return { score: 0, posts: [] as Post[] };
}

function topic(label: string, posts: Post[], score = 40): Topic {
  const platforms = {
    x: emptySlice(),
    reddit: emptySlice(),
    hn: emptySlice(),
    public: emptySlice(),
  };
  for (const p of posts) {
    platforms[p.platform].posts.push(p);
    platforms[p.platform].score = score;
  }
  return {
    id: label.toLowerCase().replace(/\s+/g, "-"),
    label,
    velocity: "rising",
    divergence: 0.5,
    tickers: [],
    platforms,
  };
}

function post(title: string, url: string, platform: Post["platform"] = "public"): Post {
  return {
    platform,
    title,
    url,
    score: 10,
    createdAt: "2026-08-26T12:00:00.000Z",
  };
}

test("validatorAgent drops invalid URLs, empty topics, and duplicate labels", () => {
  const camry = topic("Camry", [
    post("Camry hybrid", "https://en.wikipedia.org/wiki/Camry"),
    post("broken", "not-a-url"),
    post("ftp", "ftp://files.test/camry"),
  ]);
  const empty = topic("Ghost", [post("no href", "")]);
  const dup = topic("camry", [post("Camry sales", "https://news.test/camry")]);
  const tesla = topic("Tesla", [post("Tesla thread", "https://hn.test/tesla")], 150);

  const result = validatorAgent([camry, empty, dup, tesla]);
  assert.equal(result.droppedPosts, 3);
  assert.equal(result.droppedTopics, 2);
  assert.deepEqual(
    result.topics.map((t) => t.label),
    ["Camry", "Tesla"],
  );
  assert.equal(result.topics[0].platforms.public.posts.length, 1);
  assert.equal(result.topics[0].platforms.public.posts[0].url, "https://en.wikipedia.org/wiki/Camry");
  assert.equal(result.topics[1].platforms.public.score, 100);
  assert.match(result.log, /validator: -2 topics, -3 posts/);
});

test("healthFrom marks offline sources without inventing a WHY", () => {
  const { sources, degraded } = healthFrom([
    { source: "x", ok: false, count: 0, posts: [] },
    { source: "reddit", ok: true, count: 4, posts: [] },
    { source: "hn", ok: true, count: 2, posts: [] },
    { source: "public", ok: false, count: 0, posts: [] },
  ]);
  assert.deepEqual(sources, { x: false, reddit: true, hn: true, public: false });
  assert.deepEqual(degraded, ["x offline", "public offline"]);
  assert.equal(
    collectorSummary([
      { source: "x", ok: false, count: 0, posts: [] },
      { source: "hn", ok: true, count: 2, posts: [] },
    ]),
    "collector: x fail(0) hn ok(2)",
  );
});
