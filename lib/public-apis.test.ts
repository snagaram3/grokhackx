import assert from "node:assert/strict";
import { test } from "node:test";
import {
  alJazeeraAllRssUrl,
  cisaKevUrl,
  coinCapAssetsUrl,
  coinGeckoTrendingUrl,
  diseaseShUrl,
  fearGreedUrl,
  filterBskyHotByTopic,
  gdacsRssUrl,
  githubEventsUrl,
  guardianWorldRssUrl,
  parsePublicApiJsonText,
  parsePublicApisReadme,
  publicApiPost,
  WIKIPEDIA_FEATURED_AGOS,
  WIKIPEDIA_PAGEVIEWS_AGOS,
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

test("guardianWorldRssUrl is the world RSS, not a Google News site: search", () => {
  const url = guardianWorldRssUrl();
  assert.equal(url, "https://www.theguardian.com/world/rss");
  assert.equal(url.includes("news.google.com"), false);
  assert.equal(url.includes("site:theguardian.com"), false);
});

test("alJazeeraAllRssUrl is the empty-topic all.xml tape, not a Google News search", () => {
  const url = alJazeeraAllRssUrl();
  assert.equal(url, "https://www.aljazeera.com/xml/rss/all.xml");
  assert.equal(url.includes("news.google.com"), false);
  assert.equal(url.includes("site:aljazeera.com"), false);
});

test("gdacsRssUrl is the disaster RSS, not a news search", () => {
  const url = gdacsRssUrl();
  assert.equal(url, "https://www.gdacs.org/xml/rss.xml");
  assert.equal(url.includes("news.google.com"), false);
});

test("coinGeckoTrendingUrl is trending, not /search?query=", () => {
  const url = coinGeckoTrendingUrl();
  assert.equal(url, "https://api.coingecko.com/api/v3/search/trending");
  assert.equal(url.includes("query="), false);
});

test("githubEventsUrl is the public events tape, not repo search", () => {
  const url = githubEventsUrl();
  assert.equal(url, "https://api.github.com/events");
  assert.equal(url.includes("search/repositories"), false);
});

test("cisaKevUrl is the known-exploited JSON feed", () => {
  const url = cisaKevUrl();
  assert.equal(url, "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json");
  assert.equal(url.includes("nvd.nist.gov"), false);
});

test("diseaseShUrl sorts countries by todayCases", () => {
  const url = diseaseShUrl();
  assert.equal(url, "https://disease.sh/v3/covid-19/countries?sort=todayCases");
  assert.equal(url.includes("sort=cases"), false);
});

test("fearGreedUrl is a single reading, not a history dump", () => {
  const url = fearGreedUrl();
  assert.equal(url, "https://api.alternative.me/fng/?limit=1");
  assert.equal(url.includes("limit=8"), false);
});

test("coinCapAssetsUrl keeps limit=20, not PER_FEED 8", () => {
  const url = coinCapAssetsUrl();
  assert.equal(url, "https://api.coincap.io/v2/assets?limit=20");
  assert.equal(url.includes("limit=8"), false);
});

test("parsePublicApiJsonText rejects rate limits, HTML, and invalid JSON", () => {
  const url = "https://api.coingecko.com/api/v3/search/trending";
  assert.throws(() => parsePublicApiJsonText(url, 429, "{}"), /429/);
  assert.throws(() => parsePublicApiJsonText(url, 200, "You have exceeded the limit requests"), /429/);
  assert.throws(() => parsePublicApiJsonText(url, 503, "limit requests — try later"), /429/);
  assert.throws(() => parsePublicApiJsonText(url, 503, "upstream down"), /503/);
  assert.throws(() => parsePublicApiJsonText(url, 200, ""), /not json/);
  assert.throws(() => parsePublicApiJsonText(url, 200, "<html>rate page</html>"), /not json/);
  assert.throws(() => parsePublicApiJsonText(url, 200, "{"), /not json/);
  assert.deepEqual(parsePublicApiJsonText(url, 200, '{"ok":true}'), { ok: true });
});

test("publicApiPost slices titles, floors scores, and stamps collect_public_apis", () => {
  const long = "C".repeat(181);
  const stamped = publicApiPost(long, "https://nhtsa.test/camry", 0.4, "NHTSA", "2026-08-26T12:00:00.000Z");
  assert.equal(stamped.title.length, 180);
  assert.equal(stamped.score, 1);
  assert.equal(stamped.createdAt, "2026-08-26T12:00:00.000Z");
  assert.equal(stamped.tool, "collect_public_apis");
  assert.equal(stamped.platform, "public");
  assert.equal(stamped.sourceApi, "NHTSA");

  const rounded = publicApiPost("Camry", "https://nhtsa.test/camry", 1.6, "NHTSA", "2026-08-26T12:00:00.000Z");
  assert.equal(rounded.score, 2);

  const negative = publicApiPost("Camry", "https://nhtsa.test/camry", -3, "NHTSA", "2026-08-26T12:00:00.000Z");
  assert.equal(negative.score, 1);

  const fresh = publicApiPost("Camry", "https://nhtsa.test/camry", 12, "NHTSA");
  assert.ok(Number.isFinite(Date.parse(fresh.createdAt)));
});

function hotPost(title: string): Post {
  return {
    platform: "public",
    title,
    url: `https://bsky.app/profile/desk.test/post/${encodeURIComponent(title)}`,
    score: 55,
    createdAt: "2026-08-26T12:00:00.000Z",
    sourceApi: "Bluesky",
  };
}

test("filterBskyHotByTopic is a substring includes filter and caps at 8", () => {
  const hot = [
    hotPost("Camry hybrid recall"),
    hotPost("camera weather"),
    hotPost("CAMRY dealer lot"),
    hotPost("Toyota Camryx leftover"),
    ...Array.from({ length: 8 }, (_, i) => hotPost(`Camry extra ${i}`)),
  ];
  const filtered = filterBskyHotByTopic(hot, "Camry");
  assert.equal(filtered.length, 8);
  assert.ok(filtered.every((p) => p.title.toLowerCase().includes("camry")));
  assert.equal(filtered.some((p) => p.title === "camera weather"), false);
  assert.ok(filtered.some((p) => p.title === "Toyota Camryx leftover"));

  assert.equal(filterBskyHotByTopic(hot, "  ").length, 8);
  assert.equal(filterBskyHotByTopic(hot, "").length, 8);
  assert.equal(filterBskyHotByTopic(hot).length, 8);
  assert.deepEqual(
    filterBskyHotByTopic(hot, null).map((p) => p.title),
    hot.slice(0, 8).map((p) => p.title),
  );
});

test("wikipedia tape walks featured 0-2 then pageviews 2-6", () => {
  const featured = [...WIKIPEDIA_FEATURED_AGOS];
  const pageviews = [...WIKIPEDIA_PAGEVIEWS_AGOS];
  assert.deepEqual(featured, [0, 1, 2]);
  assert.deepEqual(pageviews, [2, 3, 4, 5, 6]);
  assert.equal(featured.includes(3), false);
  assert.equal(pageviews.includes(0), false);
  assert.equal(pageviews.includes(1), false);
  assert.equal(pageviews.includes(7), false);
});
