import assert from "node:assert/strict";
import { test } from "node:test";
import { collectPublicSource, collectSource } from "./agents";
import { cacheSet } from "./cache";
import { collectPublicApis } from "./public-apis";
import type { Post } from "./types";

function post(title: string, url: string): Post {
  return {
    platform: "hn",
    title,
    url,
    score: 12,
    createdAt: "2026-08-26T12:00:00.000Z",
  };
}

test("collectSource keeps titled posts and treats an empty run as offline", async () => {
  const camry = post("Camry hybrid thread", "https://news.ycombinator.com/item?id=1");
  const ok = await collectSource("hn", async () => [camry]);
  assert.equal(ok.source, "hn");
  assert.equal(ok.ok, true);
  assert.equal(ok.count, 1);
  assert.equal(ok.posts[0]?.url, "https://news.ycombinator.com/item?id=1");
  assert.equal(ok.fallback, undefined);

  const empty = await collectSource("reddit", async () => []);
  assert.equal(empty.ok, false);
  assert.equal(empty.count, 0);
  assert.deepEqual(empty.posts, []);
});

test("collectSource catch does not invent receipts when the fetcher throws", async () => {
  const failed = await collectSource("hn", async () => {
    throw new Error("hn topstories 503");
  });
  assert.equal(failed.source, "hn");
  assert.equal(failed.ok, false);
  assert.equal(failed.count, 0);
  assert.deepEqual(failed.posts, []);
  assert.equal(failed.fallback, undefined);
});

test("collectPublicApis with enabledSources=[] attempts nothing and does not invent posts", async () => {
  cacheSet("public-apis:catalog", [
    {
      name: "GDELT",
      description: "news",
      auth: "No",
      https: true,
      cors: "Yes",
      category: "News",
      url: "https://api.gdeltproject.org",
    },
  ]);
  const collected = await collectPublicApis("all", "Camry", []);
  assert.deepEqual(collected.posts, []);
  assert.equal(collected.ingest.attempted, 0);
  assert.equal(collected.ingest.live, 0);
  assert.equal(collected.ingest.topic, "Camry");
  assert.deepEqual(collected.ingest.sources, []);

  const wrapped = await collectPublicSource("all", "Camry", []);
  assert.equal(wrapped.source, "public");
  assert.equal(wrapped.ok, false);
  assert.equal(wrapped.count, 0);
  assert.deepEqual(wrapped.posts, []);
  assert.equal(wrapped.publicApis?.attempted, 0);
  assert.equal(wrapped.publicApis?.live, 0);
  assert.equal(wrapped.fallback, undefined);
});
