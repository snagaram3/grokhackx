import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bskyHref,
  gdeltStamp,
  mapBskyFeed,
  mapBskySearch,
  mapGdeltArticles,
  parsePublicApisReadme,
  parseRss,
  wikiPostsFromFeatured,
  youtubeItems,
} from "./public-apis";

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

test("parseRss keeps CDATA titles and link hrefs, skips crumbs, and refuses non-RSS", () => {
  const posts = parseRss(
    `<?xml version="1.0"?>
    <rss><channel>
      <item>
        <title><![CDATA[Camry recall <b>bulletin</b>]]></title>
        <link href="https://news.test/camry"/>
        <pubDate>2026-08-26T12:00:00.000Z</pubDate>
      </item>
      <item>
        <title>No URL dropped</title>
      </item>
      <item>
        <link>https://news.test/empty-title</link>
      </item>
    </channel></rss>`,
    "Google News",
  );
  assert.equal(posts.length, 1);
  assert.equal(posts[0].title, "Camry recall bulletin");
  assert.equal(posts[0].url, "https://news.test/camry");
  assert.equal(posts[0].sourceApi, "Google News");
  assert.equal(posts[0].createdAt, "2026-08-26T12:00:00.000Z");
  assert.equal(posts[0].tool, "collect_public_apis");
  assert.throws(() => parseRss("# Hello\n\nNo feed.", "Google News"));
  assert.throws(() => parseRss("<rss><channel><item><title></title></item></channel></rss>", "BBC"));
});

test("gdeltStamp expands compact GDELT times and mapGdeltArticles drops junk rows", () => {
  assert.equal(gdeltStamp("20260826T151230Z"), "2026-08-26T15:12:30Z");
  assert.equal(gdeltStamp("2026-08-26T15:12:30Z"), "2026-08-26T15:12:30Z");
  assert.equal(gdeltStamp(""), undefined);

  const posts = mapGdeltArticles({
    articles: [
      { title: "Camry in world news", url: "https://gdelt.test/camry", seendate: "20260826T151230Z" },
      { title: "Missing URL", seendate: "20260826T160000Z" },
      { url: "https://gdelt.test/no-title" },
      "not-a-row",
    ],
  });
  assert.equal(posts.length, 1);
  assert.equal(posts[0].title, "Camry in world news");
  assert.equal(posts[0].createdAt, "2026-08-26T15:12:30Z");
  assert.equal(posts[0].sourceApi, "GDELT");
  assert.deepEqual(mapGdeltArticles(null), []);
  assert.deepEqual(mapGdeltArticles({ articles: {} }), []);
});

test("wikiPostsFromFeatured drops Special/Main Page rows and falls back to today's featured", () => {
  const most = wikiPostsFromFeatured({
    mostread: {
      articles: [
        { title: "Special:Search", titles: { normalized: "Special:Search" }, views: 9000 },
        { title: "Main_Page", titles: { normalized: "Main Page" }, views: 8000 },
        {
          title: "Toyota_Camry",
          titles: { normalized: "Toyota Camry" },
          views: 1200,
          content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Toyota_Camry" } },
        },
      ],
    },
  });
  assert.equal(most.length, 1);
  assert.equal(most[0].title, "Wikipedia: Toyota Camry");
  assert.equal(most[0].url, "https://en.wikipedia.org/wiki/Toyota_Camry");
  assert.equal(most[0].sourceApi, "Wikipedia");

  const tfa = wikiPostsFromFeatured({
    mostread: { articles: [{ title: "Special:Search", views: 9 }] },
    tfa: {
      titles: { normalized: "Apple" },
      content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Apple" } },
    },
  });
  assert.equal(tfa.length, 1);
  assert.equal(tfa[0].title, "Wikipedia: Apple");
  assert.deepEqual(wikiPostsFromFeatured({}), []);
});

test("youtubeItems needs a title plus video id and does not invent a watch URL", () => {
  const posts = youtubeItems({
    items: [
      { id: { videoId: "abc123" }, snippet: { title: "Camry hybrid", publishedAt: "2026-08-26T12:00:00.000Z" } },
      { id: "plain-id", snippet: { title: "Civic launch" } },
      { id: { videoId: "no-title" }, snippet: {} },
      { snippet: { title: "Missing id" } },
    ],
  });
  assert.equal(posts.length, 2);
  assert.equal(posts[0].url, "https://www.youtube.com/watch?v=abc123");
  assert.equal(posts[0].sourceApi, "YouTube");
  assert.equal(posts[0].createdAt, "2026-08-26T12:00:00.000Z");
  assert.equal(posts[1].url, "https://www.youtube.com/watch?v=plain-id");
  assert.deepEqual(youtubeItems({ items: [] }), []);
});

test("Bluesky AT-URIs become profile posts; missing handle or text is dropped", () => {
  assert.equal(
    bskyHref("at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3kabc", "alice.bsky.social"),
    "https://bsky.app/profile/alice.bsky.social/post/3kabc",
  );
  assert.equal(bskyHref("at://did:plc:z72/app.bsky.feed.post/3kabc", ""), "");

  const searched = mapBskySearch({
    posts: [
      {
        uri: "at://did:plc:z72/app.bsky.feed.post/3kabc",
        author: { handle: "alice.bsky.social" },
        record: { text: "Camry on the lot", createdAt: "2026-08-26T12:00:00.000Z" },
      },
      { uri: "at://did:plc:z72/app.bsky.feed.post/nope", author: { handle: "bob.bsky.social" }, record: { text: "" } },
    ],
  });
  assert.equal(searched.length, 1);
  assert.equal(searched[0].url, "https://bsky.app/profile/alice.bsky.social/post/3kabc");
  assert.equal(searched[0].sourceApi, "Bluesky");

  const hot = mapBskyFeed({
    feed: [
      {
        post: {
          uri: "at://did:plc:z72/app.bsky.feed.post/3khot",
          author: { handle: "news.bsky.social" },
          record: { text: "World tape" },
        },
      },
    ],
  });
  assert.equal(hot.length, 1);
  assert.equal(hot[0].url, "https://bsky.app/profile/news.bsky.social/post/3khot");
});
