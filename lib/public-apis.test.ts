import assert from "node:assert/strict";
import { test } from "node:test";
import {
  asArray,
  capFeedPosts,
  capPublicPosts,
  DEFAULT_FEED_BUDGET,
  MAX_POSTS,
  num,
  parsePublicApisReadme,
  PER_FEED,
  takeFeedChunk,
  TOPIC_FEED_BUDGET,
} from "./public-apis";
import type { Post } from "./types";

const README = `
# Public APIs

### Animals

| API | Description | Auth | HTTPS | CORS |
| :--- | :--- | :--- | :--- | :--- |
| [Dog API](https://dog.ceo) | Dogs as a service | No | Yes | Yes |
| [Cat API](http://cat.test) | Cats | apiKey | No | Unknown |
| [](https://empty.test) | skip nameless | No | Yes | Yes |

Not a table row.

### Cryptocurrency

| [CoinGecko](https://www.coingecko.com) | Coin prices | None | Yes | Yes |
| [Secret Ledger](https://ledger.test) | Needs a key | \`apiKey\` | Yes | No |
`;

test("parsePublicApisReadme reads catalog rows and skips the API header", () => {
  const entries = parsePublicApisReadme(README);
  assert.deepEqual(
    entries.map((e) => e.name),
    ["Dog API", "Cat API", "CoinGecko", "Secret Ledger"],
  );
  const dogs = entries.find((e) => e.name === "Dog API");
  assert.equal(dogs?.url, "https://dog.ceo");
  assert.equal(dogs?.https, true);
  assert.equal(dogs?.auth, "No");
  assert.equal(dogs?.category, "Animals");
  assert.equal(entries.find((e) => e.name === "Cat API")?.https, false);
  assert.equal(entries.find((e) => e.name === "CoinGecko")?.category, "Cryptocurrency");
  assert.equal(entries.find((e) => e.name === "Secret Ledger")?.auth, "`apiKey`");
});

test("parsePublicApisReadme returns empty on prose with no API table", () => {
  assert.deepEqual(parsePublicApisReadme("# Hello\n\nNo tables here.\n"), []);
});

function stubPost(n: number): Post {
  return {
    platform: "public",
    title: `Story ${n}`,
    url: `https://news.test/${n}`,
    score: 40,
    createdAt: "2026-08-26T12:00:00.000Z",
    sourceApi: "BBC",
  };
}

test("world and topic feed budgets overflow MAX_POSTS without the 160 cap", () => {
  assert.equal(PER_FEED, 8);
  assert.equal(MAX_POSTS, 160);
  assert.equal(DEFAULT_FEED_BUDGET, 28);
  assert.equal(TOPIC_FEED_BUDGET, 32);
  assert.equal(DEFAULT_FEED_BUDGET * PER_FEED, 224);
  assert.equal(TOPIC_FEED_BUDGET * PER_FEED, 256);
  assert.equal(DEFAULT_FEED_BUDGET * PER_FEED > MAX_POSTS, true);
  assert.equal(TOPIC_FEED_BUDGET * PER_FEED > MAX_POSTS, true);
});

test("capFeedPosts keeps 8 and drops the 9th mapper leftover", () => {
  const posts = Array.from({ length: 9 }, (_, i) => stubPost(i));
  const capped = capFeedPosts(posts);
  assert.equal(capped.length, 8);
  assert.equal(capped[0]?.title, "Story 0");
  assert.equal(capped[7]?.title, "Story 7");
  assert.equal(
    capped.some((p) => p.title === "Story 8" || p.url === "https://news.test/8"),
    false,
  );
  assert.equal(capFeedPosts(posts.slice(0, 8)).length, 8);
  assert.deepEqual(capFeedPosts([]), []);
});

test("capPublicPosts keeps 160 and drops the 161st so 28×8 cannot flood the desk", () => {
  const posts = Array.from({ length: 161 }, (_, i) => stubPost(i));
  const capped = capPublicPosts(posts);
  assert.equal(capped.length, 160);
  assert.equal(capped[0]?.title, "Story 0");
  assert.equal(capped[159]?.title, "Story 159");
  assert.equal(
    capped.some((p) => p.title === "Story 160" || p.url === "https://news.test/160"),
    false,
  );
  assert.equal(capPublicPosts(posts.slice(0, 160)).length, 160);
});

test("takeFeedChunk rejected/empty is not live and over-8 caps without inventing a URL", () => {
  const bbc = { name: "BBC", category: "News" };

  const rejected = takeFeedChunk({ status: "rejected", reason: new Error("503") }, bbc);
  assert.equal(rejected.live, false);
  assert.deepEqual(rejected.posts, []);
  assert.equal(rejected.stat.posts, 0);
  assert.equal(rejected.stat.name, "BBC");
  assert.equal(rejected.stat.category, "News");
  assert.equal(
    rejected.posts.some((p) => p.url.includes("bbc") || p.url.includes("news.test")),
    false,
  );

  const empty = takeFeedChunk({ status: "fulfilled", value: [] }, bbc);
  assert.equal(empty.live, false);
  assert.deepEqual(empty.posts, []);
  assert.equal(empty.stat.posts, 0);

  const over = takeFeedChunk(
    { status: "fulfilled", value: Array.from({ length: 9 }, (_, i) => stubPost(i)) },
    bbc,
  );
  assert.equal(over.live, true);
  assert.equal(over.posts.length, 8);
  assert.equal(over.stat.posts, 8);
  assert.equal(over.posts[7]?.title, "Story 7");
  assert.equal(
    over.posts.some((p) => p.title === "Story 8"),
    false,
  );
});

test("num junk/NaN/Infinity is 0 and does not leak into rank", () => {
  assert.equal(num(0), 0);
  assert.equal(num(1.6), 1.6);
  assert.equal(num(-3), -3);
  assert.equal(num("12"), 12);
  assert.equal(num("  3  "), 3);
  assert.equal(num(""), 0);
  assert.equal(num("abc"), 0);
  assert.equal(num(null), 0);
  assert.equal(num(undefined), 0);
  assert.equal(num(Number.NaN), 0);
  assert.equal(num(Number.POSITIVE_INFINITY), 0);
  assert.equal(num(Number.NEGATIVE_INFINITY), 0);
  assert.equal(num({}), 0);
  assert.equal(num([]), 0);
  assert.equal(num(true), 1);
  assert.equal(num(false), 0);
});

test("asArray junk/object/string is [] and does not flatten nested arrays", () => {
  assert.deepEqual(asArray([1, "x"]), [1, "x"]);
  assert.deepEqual(asArray([]), []);
  assert.deepEqual(asArray(null), []);
  assert.deepEqual(asArray(undefined), []);
  assert.deepEqual(asArray({ items: [1] }), []);
  assert.deepEqual(asArray("items"), []);
  assert.deepEqual(asArray(1), []);
  assert.deepEqual(asArray([[1]]), [[1]]);
});
