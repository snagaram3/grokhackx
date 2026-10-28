import assert from "node:assert/strict";
import { test } from "node:test";
import {
  coinGeckoSearchOrTrending,
  coinGeckoUsesSearch,
  mergeYoutubeItems,
  nhkWorldRssUrl,
  parsePublicApisReadme,
  parseRss,
  publicApiFeedNames,
  reutersRssUrl,
  youtubeUsesSearch,
} from "./public-apis";
import type { Post } from "./types";

function tapePost(title: string, url: string, sourceApi = "CoinGecko"): Post {
  return {
    platform: "public",
    title,
    url,
    score: 60,
    createdAt: "2026-08-26T12:00:00.000Z",
    sourceApi,
  };
}

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

test("parseRss all-dropped items throw rss empty and do not invent a feed URL", () => {
  const crumbs = `<rss><channel>
    <item><title>No URL dropped</title></item>
    <item><link>https://news.test/empty-title</link></item>
  </channel></rss>`;
  try {
    parseRss(crumbs, "Reuters");
    assert.fail("expected throw");
  } catch (err) {
    assert.equal(err instanceof Error && err.message, "Reuters rss empty");
    assert.equal(String(err).includes("https://"), false);
  }
  assert.throws(
    () => parseRss(`<feed><entry><title></title><link href="https://a.test/x"/></entry></feed>`, "NHK World"),
    (err: unknown) => err instanceof Error && err.message === "NHK World rss empty",
  );
});

test("parseRss keeps at most 8 items and does not keep the 9th", () => {
  const items = Array.from({ length: 9 }, (_, i) => {
    const n = i + 1;
    return `<item><title>Story ${n}</title><link>https://news.test/${n}</link><pubDate>2026-08-26T12:00:00.000Z</pubDate></item>`;
  }).join("");
  const posts = parseRss(`<rss><channel>${items}</channel></rss>`, "BBC");
  assert.equal(posts.length, 8);
  assert.equal(posts[0].title, "Story 1");
  assert.equal(posts[0].url, "https://news.test/1");
  assert.equal(posts[7].title, "Story 8");
  assert.equal(
    posts.some((p) => p.title === "Story 9" || p.url === "https://news.test/9"),
    false,
  );
  assert.equal(posts.every((p) => p.sourceApi === "BBC"), true);
});

test("reutersRssUrl uses when:1d on the world tape and Camry site:reuters.com", () => {
  const world = reutersRssUrl();
  assert.equal(world.includes("news.google.com/rss/search"), true);
  assert.equal(world.includes("q=site%3Areuters.com%20when%3A1d"), true);
  assert.equal(world.includes("hl=en&gl=GB&ceid=GB:en"), true);
  assert.equal(world.includes("headlines/section/topic/WORLD"), false);
  assert.equal(world.includes("theguardian.com"), false);
  assert.equal(reutersRssUrl("").includes("when%3A1d"), true);
  assert.equal(reutersRssUrl("  ").includes("when%3A1d"), true);

  const camry = reutersRssUrl("Camry");
  assert.equal(camry.includes("q=Camry%20site%3Areuters.com"), true);
  assert.equal(camry.includes("when%3A1d"), false);
  assert.equal(reutersRssUrl("Toyota Camry").includes("q=Toyota%20Camry%20site%3Areuters.com"), true);
  assert.equal(camry.includes("site%3Abbc.com"), false);
});

test("nhkWorldRssUrl uses when:1d on the world tape and Camry site:nhk.or.jp", () => {
  const world = nhkWorldRssUrl();
  assert.equal(world.includes("q=site%3Anhk.or.jp%20when%3A1d"), true);
  assert.equal(world.includes("news.google.com/rss/search"), true);
  assert.equal(world.includes("nhk.or.jp/rss"), false);
  assert.equal(nhkWorldRssUrl("  ").includes("when%3A1d"), true);

  const camry = nhkWorldRssUrl("Camry");
  assert.equal(camry.includes("q=Camry%20site%3Anhk.or.jp"), true);
  assert.equal(camry.includes("when%3A1d"), false);
  assert.equal(camry.includes("site%3Areuters.com"), false);
});

test("publicApiFeedNames still lists Reuters and NHK World", () => {
  const names = publicApiFeedNames();
  assert.equal(names.includes("Reuters"), true);
  assert.equal(names.includes("NHK World"), true);
});

test("coinGeckoUsesSearch is topic-only — empty/whitespace stay on trending", () => {
  assert.equal(coinGeckoUsesSearch("Camry"), true);
  assert.equal(coinGeckoUsesSearch(" Toyota Camry "), true);
  assert.equal(coinGeckoUsesSearch(""), false);
  assert.equal(coinGeckoUsesSearch("  "), false);
  assert.equal(coinGeckoUsesSearch(undefined), false);
});

test("coinGeckoSearchOrTrending does not leak trending coins on a Camry miss", () => {
  const camry = tapePost("Camry Coin ($CAM)", "https://www.coingecko.com/en/coins/camry");
  const bitcoin = tapePost("Bitcoin ($BTC) trending", "https://www.coingecko.com/en/coins/bitcoin");

  const miss = coinGeckoSearchOrTrending([], [bitcoin], "Camry");
  assert.deepEqual(miss, []);
  assert.equal(
    miss.some((p) => /bitcoin/i.test(p.title) || p.url.includes("bitcoin")),
    false,
  );

  const hit = coinGeckoSearchOrTrending([camry], [bitcoin], "Camry");
  assert.deepEqual(hit.map((p) => p.title), ["Camry Coin ($CAM)"]);
  assert.equal(hit.some((p) => /bitcoin/i.test(p.title)), false);

  const world = coinGeckoSearchOrTrending([], [bitcoin], undefined);
  assert.deepEqual(world.map((p) => p.title), ["Bitcoin ($BTC) trending"]);
  assert.deepEqual(coinGeckoSearchOrTrending([camry], [bitcoin], "  ").map((p) => p.title), [
    "Bitcoin ($BTC) trending",
  ]);
});

test("youtubeUsesSearch is topic-only — empty/whitespace stay on mostPopular", () => {
  assert.equal(youtubeUsesSearch("Camry"), true);
  assert.equal(youtubeUsesSearch(" Toyota Camry "), true);
  assert.equal(youtubeUsesSearch(""), false);
  assert.equal(youtubeUsesSearch("  "), false);
  assert.equal(youtubeUsesSearch(undefined), false);
});

test("mergeYoutubeItems keeps the first URL, skips empty batches, and caps at 8", () => {
  const jp = tapePost("Camry ad JP", "https://www.youtube.com/watch?v=jp1", "YouTube");
  const dup = tapePost("Camry ad US copy", "https://www.youtube.com/watch?v=jp1", "YouTube");
  const us = tapePost("Camry review US", "https://www.youtube.com/watch?v=us1", "YouTube");
  const extras = Array.from({ length: 8 }, (_, i) =>
    tapePost(`Clip ${i}`, `https://www.youtube.com/watch?v=x${i}`, "YouTube"),
  );

  const merged = mergeYoutubeItems([[jp], [], [dup, us], extras]);
  assert.equal(merged.length, 8);
  assert.equal(merged[0].title, "Camry ad JP");
  assert.equal(merged[0].url, "https://www.youtube.com/watch?v=jp1");
  assert.equal(merged[1].title, "Camry review US");
  assert.equal(
    merged.filter((p) => p.url === "https://www.youtube.com/watch?v=jp1").length,
    1,
  );
  assert.equal(
    merged.some((p) => p.title === "Camry ad US copy"),
    false,
  );
  assert.equal(merged[7].url, "https://www.youtube.com/watch?v=x5");
  assert.equal(
    merged.some((p) => p.url === "https://www.youtube.com/watch?v=x6"),
    false,
  );
});
