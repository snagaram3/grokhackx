import assert from "node:assert/strict";
import { test } from "node:test";
import { arcticShiftUrl, redditHotJsonUrl, redditHotRssUrl } from "./reddit";

test("redditHotJsonUrl interpolates the sub at limit=50 and does not encode it", () => {
  assert.equal(
    redditHotJsonUrl("worldnews"),
    "https://www.reddit.com/r/worldnews/hot.json?limit=50&raw_json=1",
  );
  assert.equal(
    redditHotJsonUrl("Nigeria", "old.reddit.com"),
    "https://old.reddit.com/r/Nigeria/hot.json?limit=50&raw_json=1",
  );
  const spaced = redditHotJsonUrl("world news");
  assert.equal(spaced.includes("/r/world news/"), true);
  assert.equal(spaced.includes("world%20news"), false);
  assert.equal(spaced.includes("limit=25"), false);
  assert.equal(spaced.includes("search.json"), false);
});

test("redditHotRssUrl is /hot/.rss at limit=40, not the JSON 50", () => {
  assert.equal(
    redditHotRssUrl("worldnews"),
    "https://www.reddit.com/r/worldnews/hot/.rss?limit=40",
  );
  assert.equal(
    redditHotRssUrl("Nigeria", "old.reddit.com"),
    "https://old.reddit.com/r/Nigeria/hot/.rss?limit=40",
  );
  assert.equal(redditHotRssUrl("worldnews").includes("limit=50"), false);
  assert.equal(redditHotRssUrl("worldnews").includes("hot.json"), false);
});

test("arcticShiftUrl stays on photon-reddit with raw sub, after, sort=desc, limit=50", () => {
  const url = arcticShiftUrl("worldnews", "2026-10-22");
  assert.equal(
    url,
    "https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=worldnews&after=2026-10-22&sort=desc&limit=50",
  );
  assert.equal(url.includes("www.reddit.com"), false);
  assert.equal(arcticShiftUrl("Nigeria", "2026-10-22").includes("subreddit=Nigeria"), true);
  assert.equal(arcticShiftUrl("world news", "2026-10-22").includes("subreddit=world news"), true);
  assert.equal(arcticShiftUrl("worldnews", "2026-10-22").includes("sort=hot"), false);
});
