import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bskyHotUrl,
  bskySearchUrl,
  gdeltQueryUrl,
  parsePublicApisReadme,
  wikiOpenSearchUrl,
  youtubePopularUrl,
  youtubeSearchUrl,
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

test("youtubeSearchUrl encodes q and key and keeps maxResults=8", () => {
  assert.equal(
    youtubeSearchUrl("Camry", "dummy"),
    "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&q=Camry&key=dummy",
  );
  assert.equal(
    youtubeSearchUrl("Toyota Camry", "k ey+1"),
    "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&q=Toyota%20Camry&key=k%20ey%2B1",
  );
});

test("youtubePopularUrl interpolates regionCode raw and encodes the key", () => {
  const jp = youtubePopularUrl("JP", "dummy");
  assert.equal(
    jp,
    "https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&regionCode=JP&maxResults=8&key=dummy",
  );
  assert.match(jp, /regionCode=JP/);
  assert.equal(youtubePopularUrl("IN", "a+b").includes("key=a%2Bb"), true);
});

test("gdeltQueryUrl appends sourcelang:english and encodes colon/space", () => {
  assert.match(gdeltQueryUrl("Camry"), /query=Camry%20sourcelang%3Aenglish/);
  assert.match(gdeltQueryUrl("Toyota Camry"), /query=Toyota%20Camry%20sourcelang%3Aenglish/);
  const world = gdeltQueryUrl("  ");
  assert.equal(world, gdeltQueryUrl(undefined));
  assert.match(world, /query=sourcelang%3Aenglish/);
  assert.match(world, /maxrecords=20/);
  assert.match(world, /timespan=24h/);
  assert.equal(world.includes("sourcelang:english"), false);
});

test("bskySearchUrl encodes q and uses PER_FEED 8; hot encodes the AT-URI at limit 25", () => {
  assert.equal(
    bskySearchUrl("Camry"),
    "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=Camry&limit=8",
  );
  assert.equal(
    bskySearchUrl("Toyota Camry"),
    "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=Toyota%20Camry&limit=8",
  );
  const hot = bskyHotUrl();
  assert.match(hot, /feed=at%3A%2F%2Fdid%3Aplc/);
  assert.match(hot, /limit=25/);
  assert.equal(hot.includes("at://"), false);
  assert.equal(hot.includes("limit=8"), false);
});

test("wikiOpenSearchUrl encodes the topic and keeps limit=10 / namespace=0", () => {
  assert.equal(
    wikiOpenSearchUrl("Camry"),
    "https://en.wikipedia.org/w/api.php?action=opensearch&search=Camry&limit=10&namespace=0&format=json",
  );
  assert.equal(
    wikiOpenSearchUrl("  Toyota Camry  "),
    "https://en.wikipedia.org/w/api.php?action=opensearch&search=Toyota%20Camry&limit=10&namespace=0&format=json",
  );
  assert.equal(wikiOpenSearchUrl("Camry").includes("limit=8"), false);
});
