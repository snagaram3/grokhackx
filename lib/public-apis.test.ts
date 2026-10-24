import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bbcWorldRssUrl,
  eonetEventsUrl,
  fbiWantedUrl,
  googleNewsWorldUrl,
  nwsAlertsUrl,
  openLibraryTrendingUrl,
  parsePublicApisReadme,
  usgsQuakesUrl,
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

test("googleNewsWorldUrl is WORLD headlines, not a phrase search", () => {
  const url = googleNewsWorldUrl();
  assert.equal(
    url,
    "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en&gl=GB&ceid=GB:en",
  );
  assert.equal(url.includes("/rss/search"), false);
  assert.equal(url.includes("q="), false);
  assert.match(url, /hl=en&gl=GB&ceid=GB:en/);
});

test("bbcWorldRssUrl is the world RSS, not a Google News site: search", () => {
  const url = bbcWorldRssUrl();
  assert.equal(url, "https://feeds.bbci.co.uk/news/world/rss.xml");
  assert.equal(url.includes("news.google.com"), false);
  assert.equal(url.includes("site:bbc.com"), false);
});

test("openLibraryTrendingUrl is daily trending, not the language:eng fallback", () => {
  const url = openLibraryTrendingUrl();
  assert.equal(url, "https://openlibrary.org/trending/daily.json");
  assert.equal(url.includes("search.json"), false);
  assert.equal(url.includes("language"), false);
});

test("eonetEventsUrl keeps limit=12 and days=7, not PER_FEED 8", () => {
  const url = eonetEventsUrl();
  assert.equal(url, "https://eonet.gsfc.nasa.gov/api/v3/events?limit=12&days=7");
  assert.equal(url.includes("limit=8"), false);
});

test("usgsQuakesUrl is significant_week, not the all-day feed", () => {
  const url = usgsQuakesUrl();
  assert.equal(
    url,
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson",
  );
  assert.equal(url.includes("all_day"), false);
  assert.equal(url.includes("significant_month"), false);
});

test("nwsAlertsUrl is actual alerts only", () => {
  const url = nwsAlertsUrl();
  assert.equal(url, "https://api.weather.gov/alerts/active?status=actual&message_type=alert");
  assert.equal(url.includes("status=test"), false);
});

test("fbiWantedUrl is pageSize=10, not PER_FEED 8", () => {
  const url = fbiWantedUrl();
  assert.equal(url, "https://api.fbi.gov/wanted/v1/list?pageSize=10");
  assert.equal(url.includes("pageSize=8"), false);
});
