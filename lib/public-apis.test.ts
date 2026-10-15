import assert from "node:assert/strict";
import { test } from "node:test";
import { googleNewsRss, parsePublicApisReadme, selectFeeds } from "./public-apis";

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

const WORLD_CORE = [
  "Wikipedia",
  "CoinGecko",
  "National Weather Service",
  "GDACS",
  "Google News",
  "BBC",
  "Guardian",
  "Reuters",
  "Al Jazeera",
  "NHK World",
  "Bluesky",
  "Federal Register",
];

test("googleNewsRss encodes the query and keeps the GB edition", () => {
  assert.equal(
    googleNewsRss("Camry"),
    "https://news.google.com/rss/search?q=Camry&hl=en&gl=GB&ceid=GB:en",
  );
  assert.equal(
    googleNewsRss("Camry site:bbc.com"),
    "https://news.google.com/rss/search?q=Camry%20site%3Abbc.com&hl=en&gl=GB&ceid=GB:en",
  );
  assert.equal(
    googleNewsRss("site:reuters.com when:1d"),
    "https://news.google.com/rss/search?q=site%3Areuters.com%20when%3A1d&hl=en&gl=GB&ceid=GB:en",
  );
  assert.equal(
    googleNewsRss("Camry", "hl=en&gl=US&ceid=US:en"),
    "https://news.google.com/rss/search?q=Camry&hl=en&gl=US&ceid=US:en",
  );
});

test("selectFeeds world core tape and Camry topicAware skip YouTube without a key", () => {
  const prev = process.env.YOUTUBE_API_KEY;
  delete process.env.YOUTUBE_API_KEY;
  try {
    const world = selectFeeds().map((f) => f.name);
    assert.deepEqual(world.slice(0, WORLD_CORE.length), WORLD_CORE);
    assert.equal(world.includes("YouTube"), false);

    const camry = selectFeeds("Camry").map((f) => f.name);
    assert.ok(camry.includes("Google News"));
    assert.ok(camry.includes("BBC"));
    assert.ok(camry.includes("Wikipedia"));
    assert.ok(camry.includes("NHTSA"));
    assert.equal(camry.includes("YouTube"), false);
    const guardianAt = camry.indexOf("Guardian");
    if (guardianAt >= 0) {
      assert.ok(camry.indexOf("Google News") < guardianAt);
    }

    assert.deepEqual(
      selectFeeds(undefined, ["Google News"]).map((f) => f.name),
      ["Google News"],
    );
    assert.deepEqual(selectFeeds("Camry", []).map((f) => f.name), []);

    process.env.YOUTUBE_API_KEY = "  ";
    assert.equal(selectFeeds("Camry").some((f) => f.name === "YouTube"), false);

    process.env.YOUTUBE_API_KEY = "dummy";
    assert.equal(selectFeeds("Camry").some((f) => f.name === "YouTube"), true);
  } finally {
    if (prev === undefined) delete process.env.YOUTUBE_API_KEY;
    else process.env.YOUTUBE_API_KEY = prev;
  }
});
