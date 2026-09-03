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
