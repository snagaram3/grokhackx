import assert from "node:assert/strict";
import { test } from "node:test";
import { attachPublicPosts, attachXPosts } from "./cluster";
import type { Post, Topic } from "./types";

function emptySlice() {
  return { score: 0, posts: [] as Post[] };
}

function topic(id: string, label: string): Topic {
  return {
    id,
    label,
    velocity: "rising",
    divergence: 0.5,
    tickers: [],
    platforms: {
      x: emptySlice(),
      reddit: emptySlice(),
      hn: emptySlice(),
      public: emptySlice(),
    },
  };
}

function post(title: string, platform: Post["platform"], score = 20): Post {
  return {
    platform,
    title,
    url: `https://${platform}.test/${encodeURIComponent(title)}`,
    score,
    createdAt: "2026-08-26T12:00:00.000Z",
  };
}

test("attachXPosts keeps Camry exact and does not treat camera as a hit", () => {
  const camry = topic("camry", "Camry");
  const attached = attachXPosts([camry], [
    post("New Camry hybrid recall", "x", 40),
    post("camera sensor firmware", "x", 90),
  ]);
  assert.equal(attached[0].platforms.x.posts.length, 1);
  assert.equal(attached[0].platforms.x.posts[0].title, "New Camry hybrid recall");
  assert.equal(
    attached[0].platforms.x.posts.some((p) => /camera/i.test(p.title)),
    false,
  );
  const leftover = attached.filter((t) => t.id !== "camry");
  assert.equal(leftover.length, 1);
  assert.match(leftover[0].label, /camera/i);
});

test("attachXPosts leaves the tape unchanged when X is empty", () => {
  const camry = topic("camry", "Camry");
  const same = attachXPosts([camry], []);
  assert.equal(same.length, 1);
  assert.equal(same[0].platforms.x.posts.length, 0);
});

test("attachXPosts does not reuse a print across two topics", () => {
  const camry = topic("camry", "Camry hybrid");
  const toyota = topic("toyota", "Toyota Camry");
  attachXPosts([camry, toyota], [post("Toyota Camry hybrid recall", "x", 50)]);
  const hits = [camry, toyota].filter((t) => t.platforms.x.posts.length > 0);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].platforms.x.posts[0].title, "Toyota Camry hybrid recall");
});

test("2/9 token overlap meets public 0.22 and misses X 0.25", () => {
  const label = "alpha bravo charlie delta echo foxtrot golf hotel india";
  const near =
    "alpha bravo zulu yankee xray whiskey victor uniform tango";
  const xTape = [topic("x-near", label)];
  attachXPosts(xTape, [post(near, "x", 30)]);
  assert.equal(xTape[0].platforms.x.posts.length, 0);

  const publicTape = [topic("pub-near", label)];
  attachPublicPosts(publicTape, [post(near, "public", 30)]);
  assert.equal(publicTape[0].platforms.public.posts.length, 1);
  assert.equal(publicTape[0].platforms.public.posts[0].title, near);
});

test("attachPublicPosts hydrates unmatched leftovers by score, not as a shared WHY", () => {
  const camry = topic("camry", "Camry");
  const attached = attachPublicPosts([camry], [
    post("Open Library catalog dump", "public", 10),
    post("Camry NHTSA recall bulletin", "public", 80),
    post("unrelated weather advisory", "public", 40),
  ]);
  assert.equal(attached[0].platforms.public.posts.length, 1);
  assert.match(attached[0].platforms.public.posts[0].title, /Camry/);
  const leftoverTitles = attached.slice(1).map((t) => t.label);
  assert.ok(leftoverTitles.includes("unrelated weather advisory"));
  assert.ok(leftoverTitles.includes("Open Library catalog dump"));
});
