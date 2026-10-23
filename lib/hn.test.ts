import assert from "node:assert/strict";
import { test } from "node:test";
import { hnItemUrl, hnStoryUrl, hnTopUrl } from "./hn";

test("hnTopUrl and hnItemUrl stay on firebaseio v0, not Algolia", () => {
  assert.equal(hnTopUrl(), "https://hacker-news.firebaseio.com/v0/topstories.json");
  assert.equal(hnItemUrl(42), "https://hacker-news.firebaseio.com/v0/item/42.json");
  assert.equal(hnTopUrl().includes("hn.algolia.com"), false);
  assert.equal(hnItemUrl(42).includes("news.ycombinator.com"), false);
});

test("hnStoryUrl is the discussion fallback when a hit has no outbound url", () => {
  assert.equal(hnStoryUrl(886677), "https://news.ycombinator.com/item?id=886677");
  assert.equal(hnStoryUrl("886677"), "https://news.ycombinator.com/item?id=886677");
  assert.equal(hnStoryUrl(undefined), "https://news.ycombinator.com/item?id=undefined");
  assert.equal(hnStoryUrl(886677).includes("firebaseio"), false);
});
