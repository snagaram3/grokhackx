import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parsePublicApisReadme,
  parseRss,
  rssRankScore,
  youtubeKey,
  youtubePostsIfKeyed,
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

test("rssRankScore falls 80, 77, 74 and floors at 5", () => {
  assert.equal(rssRankScore(0), 80);
  assert.equal(rssRankScore(1), 77);
  assert.equal(rssRankScore(2), 74);
  assert.equal(rssRankScore(25), 5);
  assert.equal(rssRankScore(26), 5);
  assert.equal(rssRankScore(100), 5);
});

test("parseRss ranks kept items 80 then 77 and does not spend rank on crumbs", () => {
  const xml = `<rss><channel>
    <item>
      <title>Camry recall</title>
      <link>https://news.test/camry</link>
      <pubDate>2026-08-26T12:00:00.000Z</pubDate>
    </item>
    <item><title>Title only dropped</title></item>
    <item><link>https://news.test/href-only</link></item>
    <item>
      <title>Civic update</title>
      <link> https://news.test/civic </link>
      <published>2026-08-26T10:00:00.000Z</published>
      <updated>2026-08-26T11:00:00.000Z</updated>
      <pubDate>2026-08-26T09:00:00.000Z</pubDate>
    </item>
  </channel></rss>`;
  const posts = parseRss(xml, "BBC");
  assert.equal(posts.length, 2);
  assert.equal(posts[0].title, "Camry recall");
  assert.equal(posts[0].url, "https://news.test/camry");
  assert.equal(posts[0].score, 80);
  assert.equal(posts[0].createdAt, "2026-08-26T12:00:00.000Z");
  assert.equal(posts[0].sourceApi, "BBC");
  assert.equal(posts[0].tool, "collect_public_apis");
  assert.equal(posts[1].title, "Civic update");
  assert.equal(posts[1].url, "https://news.test/civic");
  assert.equal(posts[1].score, 77);
  assert.equal(posts[1].createdAt, "2026-08-26T10:00:00.000Z");
  assert.equal(
    posts.some((p) => p.url === "https://news.test/href-only" || p.title === "Title only dropped"),
    false,
  );
});

test("parseRss prefers link href over inner text and does not keep the inner URL", () => {
  const posts = parseRss(
    `<rss><channel>
      <item>
        <title>Camry</title>
        <link href="https://news.test/href-attr">https://news.test/inner</link>
        <pubDate>2026-08-26T12:00:00.000Z</pubDate>
      </item>
    </channel></rss>`,
    "Reuters",
  );
  assert.equal(posts.length, 1);
  assert.equal(posts[0].url, "https://news.test/href-attr");
  assert.equal(posts[0].score, 80);
  assert.equal(posts[0].url.includes("inner"), false);
});

test("youtubeKey empty/whitespace is blank and dummy keys trim", () => {
  assert.equal(youtubeKey(""), "");
  assert.equal(youtubeKey("  "), "");
  assert.equal(youtubeKey("dummy"), "dummy");
  assert.equal(youtubeKey("  dummy-key  "), "dummy-key");
  assert.equal(Boolean(youtubeKey("  ")), false);
  assert.equal(Boolean(youtubeKey("k")), true);
});

test("youtubePostsIfKeyed empty/whitespace returns [] without fetch", async () => {
  let fetches = 0;
  const camry: Post = {
    platform: "public",
    title: "Camry ad",
    url: "https://www.youtube.com/watch?v=camry",
    score: 60,
    createdAt: "2026-08-26T12:00:00.000Z",
    sourceApi: "YouTube",
  };
  const fetchPosts = async () => {
    fetches += 1;
    return [camry];
  };

  assert.deepEqual(await youtubePostsIfKeyed("", fetchPosts), []);
  assert.deepEqual(await youtubePostsIfKeyed("  ", fetchPosts), []);
  assert.deepEqual(await youtubePostsIfKeyed(undefined, fetchPosts), []);
  assert.equal(fetches, 0);

  const hit = await youtubePostsIfKeyed("dummy", fetchPosts);
  assert.equal(fetches, 1);
  assert.deepEqual(hit.map((p) => p.url), ["https://www.youtube.com/watch?v=camry"]);
  assert.equal(
    hit.some((p) => p.url.includes("watch?v=camry")),
    true,
  );
});
