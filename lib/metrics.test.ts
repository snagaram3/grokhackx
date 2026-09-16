import assert from "node:assert/strict";
import { test } from "node:test";
import { scalePosts, singletonTopics } from "./metrics";
import type { Post } from "./types";

function post(score: number, extra: Partial<Post> = {}): Post {
  return {
    platform: extra.platform ?? "public",
    title: extra.title ?? `post-${score}`,
    url: extra.url ?? `https://a.test/${score}`,
    score,
    createdAt: extra.createdAt ?? "2026-08-26T12:00:00.000Z",
    ...extra,
  };
}

test("scalePosts is 0 on empty, 1 on all-zero, and avg/max otherwise", () => {
  assert.equal(scalePosts([]), 0);
  assert.equal(scalePosts([post(0), post(0)]), 1);
  assert.equal(scalePosts([post(10), post(10)]), 100);
  assert.equal(scalePosts([post(10), post(30)]), 67);
  assert.equal(scalePosts([post(10), post(30)], 10), 7);
});

test("singletonTopics ranks by score, caps at 18, and keeps other platforms empty", () => {
  const ranked = singletonTopics(
    [post(9, { title: "Camry hybrid", platform: "hn" }), post(99, { title: "Tesla thread", platform: "reddit" })],
  );
  assert.deepEqual(
    ranked.map((t) => t.label),
    ["Tesla thread", "Camry hybrid"],
  );
  assert.equal(ranked[0].id, "tesla-thread");
  assert.equal(ranked[0].platforms.reddit.score, 80);
  assert.equal(ranked[0].platforms.reddit.posts.length, 1);
  assert.equal(ranked[0].platforms.public.posts.length, 0);
  assert.equal(ranked[0].platforms.x.score, 0);
  assert.equal(ranked[1].platforms.hn.score, 40);

  const many = Array.from({ length: 20 }, (_, i) => post(100 - i, { title: `Item ${i}` }));
  assert.equal(singletonTopics(many).length, 18);
  assert.equal(singletonTopics(many)[0].label, "Item 0");
});
