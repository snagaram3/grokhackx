import assert from "node:assert/strict";
import { test } from "node:test";
import { neighborTopics, plugTopicFromPosts } from "./cluster";
import { inferQueryIntent } from "./query";
import type { Post, Topic } from "./types";

function emptySlice() {
  return { score: 0, posts: [] as Post[] };
}

function post(title: string, platform: Post["platform"] = "public"): Post {
  return {
    platform,
    title,
    url: `https://a.test/${encodeURIComponent(title)}`,
    score: 12,
    createdAt: "2026-08-26T12:00:00.000Z",
  };
}

test("plugTopicFromPosts keeps Camry exact and does not treat camera as a hit", () => {
  const intent = inferQueryIntent("Camry");
  const exact = plugTopicFromPosts(
    "Camry",
    [
      post("New Camry hybrid recall"),
      post("Toyota Camry automotive repair"),
      post("camera sensor firmware"),
    ],
    intent,
  );
  assert.equal(exact[0].match, "exact");
  assert.ok(exact[0].platforms.public.posts.every((p) => /camry/i.test(p.title)));
  assert.equal(
    exact[0].platforms.public.posts.some((p) => /camera/i.test(p.title)),
    false,
  );

  const near = plugTopicFromPosts("Camry", [post("camera sensor firmware")], intent);
  assert.notEqual(near[0].match, "exact");
  assert.equal(near[0].platforms.public.posts.length, 0);
});

test("clusterTopics without a Google key falls back to score-ranked singletons", async () => {
  const prevGoogle = process.env.GOOGLE_API_KEY;
  const prevGemini = process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const sources = { x: false, reddit: true, hn: true, public: false };
  try {
    const { clusterTopics } = await import("./cluster");
    const grouped = await clusterTopics({
      reddit: [post("Camry hybrid recall", "reddit")],
      hn: [{ ...post("Civic thread", "hn"), score: 90 }],
      x: [],
      public: [],
      sources,
      degraded: [],
    });
    assert.equal(grouped.length, 2);
    assert.equal(grouped[0].label, "Civic thread");
    assert.equal(grouped[0].platforms.hn.posts.length, 1);
    assert.equal(grouped[0].platforms.reddit.posts.length, 0);
    assert.equal(grouped[1].label, "Camry hybrid recall");
    assert.equal(grouped[1].match, undefined);

    const many = await clusterTopics({
      reddit: Array.from({ length: 20 }, (_, i) => ({
        ...post(`zzzz ${i}`, "reddit"),
        score: 20 - i,
      })),
      hn: [],
      x: [],
      public: [],
      sources,
      degraded: [],
    });
    assert.equal(many.length, 18);
  } finally {
    if (prevGoogle === undefined) delete process.env.GOOGLE_API_KEY;
    else process.env.GOOGLE_API_KEY = prevGoogle;
    if (prevGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevGemini;
  }
});

test("neighborTopics only returns tape prints that share the query tokens", () => {
  const camry: Topic = {
    id: "camry",
    label: "Camry",
    velocity: "rising",
    divergence: 0.5,
    tickers: [],
    platforms: { x: emptySlice(), reddit: emptySlice(), hn: emptySlice(), public: emptySlice() },
  };
  const tesla: Topic = { ...camry, id: "tesla", label: "Tesla" };
  const hits = neighborTopics("Camry", ["Toyota Camry"], [camry, tesla]);
  assert.deepEqual(hits.map((t) => t.id), ["camry"]);
  assert.equal(hits[0].match, "neighbor");
});
