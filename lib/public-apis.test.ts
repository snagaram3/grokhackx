import assert from "node:assert/strict";
import { test } from "node:test";
import {
  arxivQueryUrl,
  noAuth,
  parsePublicApisReadme,
  utcYmd,
  wikiFeaturedUrl,
  wikiPageviewsUrl,
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

test("noAuth keeps No/None/empty/null and drops keyed rows after stripping ticks", () => {
  assert.equal(noAuth("No"), true);
  assert.equal(noAuth(" NONE "), true);
  assert.equal(noAuth(""), true);
  assert.equal(noAuth("  "), true);
  assert.equal(noAuth("null"), true);
  assert.equal(noAuth("`apiKey`"), false);
  assert.equal(noAuth("*apiKey*"), false);
  assert.equal(noAuth("OAuth"), false);
});

test("utcYmd walks UTC calendar boundaries and zero-pads month/day", () => {
  const march = new Date("2026-03-01T12:00:00.000Z");
  assert.deepEqual(utcYmd(0, march), { y: 2026, m: "03", day: "01" });
  assert.deepEqual(utcYmd(1, march), { y: 2026, m: "02", day: "28" });
  assert.deepEqual(utcYmd(1, new Date("2024-03-01T12:00:00.000Z")), { y: 2024, m: "02", day: "29" });
  assert.deepEqual(utcYmd(1, new Date("2026-01-01T00:00:00.000Z")), { y: 2025, m: "12", day: "31" });
  assert.deepEqual(utcYmd(0, new Date("2026-05-09T00:00:00.000Z")), { y: 2026, m: "05", day: "09" });
});

test("wiki featured and pageviews URLs use the UTC date path", () => {
  const now = new Date("2026-03-01T12:00:00.000Z");
  assert.equal(
    wikiFeaturedUrl(1, now),
    "https://en.wikipedia.org/api/rest_v1/feed/featured/2026/02/28",
  );
  assert.equal(
    wikiPageviewsUrl(1, now),
    "https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/2026/02/28",
  );
});

test("arxivQueryUrl encodes the topic and still prefixes all: onto the default cs.AI query", () => {
  assert.equal(
    arxivQueryUrl("Camry"),
    "https://export.arxiv.org/api/query?search_query=all:Camry&start=0&max_results=8&sortBy=submittedDate&sortOrder=descending",
  );
  assert.equal(
    arxivQueryUrl("Toyota Camry"),
    "https://export.arxiv.org/api/query?search_query=all:Toyota%20Camry&start=0&max_results=8&sortBy=submittedDate&sortOrder=descending",
  );
  const world = arxivQueryUrl("  ");
  assert.equal(world, arxivQueryUrl(undefined));
  assert.match(world, /search_query=all:cat%3Acs\.AI/);
  assert.match(world, /max_results=8/);
});
