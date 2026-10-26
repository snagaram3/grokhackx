import assert from "node:assert/strict";
import { test } from "node:test";
import {
  carbonIntensityUrl,
  cryptoCompareNewsUrl,
  espnScoreboardUrls,
  frankfurterLatestUrl,
  itunesChartsUrl,
  lobstersHottestUrl,
  mastodonTrendsUrl,
  nagerHolidaysUrl,
  openFoodFactsSearchUrl,
  parsePublicApisReadme,
  publicApiCatalogUrl,
  publicApiFeedNames,
  spacexLaunchLibraryUrl,
  spacexUpcomingUrl,
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

test("publicApiCatalogUrl is the public-apis README, not an individual feed", () => {
  const url = publicApiCatalogUrl();
  assert.equal(
    url,
    "https://raw.githubusercontent.com/public-apis/public-apis/master/README.md",
  );
  assert.equal(url.includes("api.github.com"), false);
  assert.equal(url.includes("/events"), false);
});

test("espnScoreboardUrls are UCL, EPL, and NFL — not NBA or MLB", () => {
  const urls = espnScoreboardUrls();
  assert.deepEqual(urls, [
    "https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard",
    "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard",
    "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
  ]);
  assert.equal(urls.some((u) => u.includes("/nba/")), false);
  assert.equal(urls.some((u) => u.includes("/mlb/")), false);
  assert.equal(urls.length, 3);
});

test("spacexUpcomingUrl is v5 upcoming, not Launch Library", () => {
  const url = spacexUpcomingUrl();
  assert.equal(url, "https://api.spacexdata.com/v5/launches/upcoming");
  assert.equal(url.includes("thespacedevs.com"), false);
  assert.equal(url.includes("/latest"), false);
});

test("spacexLaunchLibraryUrl keeps limit=8 and unencoded lsp__name=SpaceX", () => {
  const url = spacexLaunchLibraryUrl();
  assert.equal(
    url,
    "https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=8&lsp__name=SpaceX",
  );
  assert.equal(url.includes("lsp%5F%5Fname"), false);
  assert.equal(url.includes("limit=12"), false);
  assert.equal(url.includes("api.spacexdata.com"), false);
});

test("frankfurterLatestUrl is USD spot pairs, not a history dump", () => {
  const url = frankfurterLatestUrl();
  assert.equal(url, "https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,INR");
  assert.equal(url.includes("to=EUR%2C"), false);
  assert.equal(url.includes("BTC"), false);
  assert.equal(url.includes("/2013-01-01"), false);
});

test("carbonIntensityUrl is the UK national intensity, not a regional feed", () => {
  const url = carbonIntensityUrl();
  assert.equal(url, "https://api.carbonintensity.org.uk/intensity");
  assert.equal(url.includes("/regional"), false);
  assert.equal(url.includes("/generation"), false);
});

test("itunesChartsUrl is US most-played songs, not search?term=", () => {
  const url = itunesChartsUrl();
  assert.equal(
    url,
    "https://rss.applemarketingtools.com/api/v2/us/music/most-played/10/songs.json",
  );
  assert.equal(url.includes("itunes.apple.com/search"), false);
  assert.equal(url.includes("term="), false);
  assert.equal(url.includes("/gb/"), false);
});

test("mastodonTrendsUrl is mastodon.social tags at limit=10, not PER_FEED 8", () => {
  const url = mastodonTrendsUrl();
  assert.equal(url, "https://mastodon.social/api/v1/trends/tags?limit=10");
  assert.equal(url.includes("limit=8"), false);
  assert.equal(url.includes("/statuses"), false);
});

test("lobstersHottestUrl is hottest.json, not newest", () => {
  const url = lobstersHottestUrl();
  assert.equal(url, "https://lobste.rs/hottest.json");
  assert.equal(url.includes("newest"), false);
  assert.equal(url.includes("/rss"), false);
});

test("openFoodFactsSearchUrl sorts unique_scans and keeps page_size=8", () => {
  const url = openFoodFactsSearchUrl();
  assert.equal(
    url,
    "https://world.openfoodfacts.org/cgi/search.pl?action=process&sort_by=unique_scans_n&page_size=8&json=1&fields=product_name,code,url,unique_scans_n",
  );
  assert.equal(url.includes("sort_by=popularity"), false);
  assert.equal(url.includes("page_size=10"), false);
});

test("nagerHolidaysUrl is worldwide, not a country NextPublicHolidays path", () => {
  const url = nagerHolidaysUrl();
  assert.equal(url, "https://date.nager.at/api/v3/NextPublicHolidaysWorldwide");
  assert.equal(url.includes("NextPublicHolidays/US"), false);
  assert.equal(url.includes("/AvailableCountries"), false);
});

test("cryptoCompareNewsUrl is English news, not a price ticker", () => {
  const url = cryptoCompareNewsUrl();
  assert.equal(url, "https://min-api.cryptocompare.com/data/v2/news/?lang=EN");
  assert.equal(url.includes("/pricemulti"), false);
  assert.equal(url.includes("lang=DE"), false);
});

test("publicApiFeedNames still lists leftover world JSON feeds", () => {
  const names = publicApiFeedNames();
  for (const name of [
    "ESPN",
    "SpaceX",
    "Frankfurter",
    "Carbon Intensity",
    "iTunes",
    "Mastodon",
    "Lobsters",
    "Open Food Facts",
    "Nager.Date",
    "CryptoCompare",
  ]) {
    assert.equal(names.includes(name), true, name);
  }
});
