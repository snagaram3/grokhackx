import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CLUSTER_COMPACT,
  compact,
  hydrate,
  neighborTopics,
  plugTopicFromPosts,
} from "./cluster";
import { inferQueryIntent } from "./query";
import { scalePosts } from "./metrics";
import type { Post, Topic } from "./types";

function emptySlice() {
  return { score: 0, posts: [] as Post[] };
}

function post(title: string, platform: Post["platform"] = "public", score = 12): Post {
  return {
    platform,
    title,
    url: `https://a.test/${encodeURIComponent(title)}`,
    score,
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

test("CLUSTER_COMPACT is reddit/hn 25 and x 15, not singletonTopics 18", () => {
  assert.deepEqual(CLUSTER_COMPACT, { reddit: 25, hn: 25, x: 15 });
  assert.notEqual(CLUSTER_COMPACT.x, 18);
  assert.notEqual(CLUSTER_COMPACT.reddit, 15);
});

test("compact ranks by score, slices n, and stamps post-sort i not the input index", () => {
  const long = `high-score Camry recall ${"x".repeat(120)}`;
  assert.ok(long.length > 140);
  const rows = compact(
    [
      post("low", "reddit", 10),
      post(long, "reddit", 90),
      post("mid", "reddit", 50),
    ],
    2,
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].score, 90);
  assert.equal(rows[0].title.length, 140);
  assert.equal(rows[0].title.startsWith("high-score Camry recall"), true);
  assert.equal(rows[0].i, 0);
  assert.equal(rows[1].i, 1);
  assert.equal(rows[1].title, "mid");
  assert.equal(
    compact(
      Array.from({ length: CLUSTER_COMPACT.reddit + 1 }, (_, i) =>
        post(`Camry ${i}`, "reddit", i),
      ),
      CLUSTER_COMPACT.reddit,
    ).length,
    25,
  );
});

test("hydrate uses the first X score not scalePosts, and slices 5", () => {
  const six = Array.from({ length: 6 }, (_, i) => post(`Camry x ${i}`, "x", 80 - i));
  const topic = hydrate("Camry", { x: six, reddit: [], hn: [], public: [] });
  assert.equal(topic.id, "camry");
  assert.equal(topic.velocity, "peaking");
  assert.equal(topic.platforms.x.posts.length, 5);
  assert.equal(topic.platforms.x.score, 80);
  assert.notEqual(topic.platforms.x.score, scalePosts(six.slice(0, 5)));
  assert.equal(topic.platforms.x.posts.some((p) => p.title === "Camry x 5"), false);
  assert.equal(topic.platforms.reddit.score, 0);
  assert.equal(topic.tickers.length, 0);

  const reddit = hydrate("Camry", {
    x: [],
    reddit: [post("Camry recall", "reddit", 40)],
    hn: [],
    public: [],
  });
  assert.equal(reddit.platforms.reddit.score, scalePosts([post("Camry recall", "reddit", 40)]));
  assert.equal(reddit.platforms.x.score, 0);
});
