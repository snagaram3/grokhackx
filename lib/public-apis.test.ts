import assert from "node:assert/strict";
import { test } from "node:test";
import {
  asRecord,
  FEED_MS,
  ingestCatalogCount,
  parsePublicApisReadme,
  sortIngestFeeds,
  str,
  tryLoadPublicApiCatalog,
} from "./public-apis";
import type { PublicApiEntry } from "./public-apis";
import type { PublicApiFeedStat } from "./types";

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

test("str junk/number/object is empty and does not coerce a title", () => {
  assert.equal(str("Camry"), "Camry");
  assert.equal(str("  Toyota Camry  "), "  Toyota Camry  ");
  assert.equal(str(""), "");
  assert.equal(str("   "), "   ");
  assert.equal(str(null), "");
  assert.equal(str(undefined), "");
  assert.equal(str(12), "");
  assert.equal(str(0), "");
  assert.equal(str(true), "");
  assert.equal(str(false), "");
  assert.equal(str({ title: "Camry" }), "");
  assert.equal(str(["Camry"]), "");
});

test("asRecord array/null/string is null and does not treat a list as a map", () => {
  assert.deepEqual(asRecord({ title: "Camry" }), { title: "Camry" });
  assert.deepEqual(asRecord({}), {});
  assert.equal(asRecord(null), null);
  assert.equal(asRecord(undefined), null);
  assert.equal(asRecord([]), null);
  assert.equal(asRecord([{ title: "Camry" }]), null);
  assert.equal(asRecord("items"), null);
  assert.equal(asRecord(1), null);
  assert.equal(asRecord(true), null);
});

test("tryLoadPublicApiCatalog throw is null and collect still proceeds at catalog 0", async () => {
  const catalog = await tryLoadPublicApiCatalog(async () => {
    throw new Error("public-apis catalog 503");
  });
  assert.equal(catalog, null);
  assert.equal(ingestCatalogCount(catalog), 0);
  assert.equal(ingestCatalogCount(undefined), 0);
  assert.equal(ingestCatalogCount([]), 0);
  assert.equal(
    catalog?.some((e) => e.url.includes("github.com") || e.url.includes("public-apis")),
    undefined,
  );
});

test("tryLoadPublicApiCatalog success keeps the loaded rows", async () => {
  const rows: PublicApiEntry[] = [
    {
      name: "Dog API",
      description: "Dogs",
      auth: "No",
      https: true,
      cors: "Yes",
      category: "Animals",
      url: "https://dog.ceo",
    },
  ];
  const catalog = await tryLoadPublicApiCatalog(async () => rows);
  assert.equal(catalog, rows);
  assert.equal(ingestCatalogCount(catalog), 1);
  assert.equal(catalog?.[0]?.url, "https://dog.ceo");
});

test("sortIngestFeeds is busiest-first and does not mutate collect order", () => {
  const feeds: PublicApiFeedStat[] = [
    { name: "Reuters", category: "News", posts: 0 },
    { name: "BBC", category: "News", posts: 8 },
    { name: "Guardian", category: "News", posts: 3 },
  ];
  const sorted = sortIngestFeeds(feeds);
  assert.deepEqual(
    sorted.map((f) => f.name),
    ["BBC", "Guardian", "Reuters"],
  );
  assert.deepEqual(
    feeds.map((f) => f.name),
    ["Reuters", "BBC", "Guardian"],
  );
  assert.equal(sorted[0]?.posts, 8);
  assert.equal(sorted[2]?.posts, 0);
  assert.deepEqual(sortIngestFeeds([]), []);
});

test("sortIngestFeeds equal post counts keep insertion order", () => {
  const feeds: PublicApiFeedStat[] = [
    { name: "BBC", category: "News", posts: 8 },
    { name: "Reuters", category: "News", posts: 8 },
    { name: "NYT", category: "News", posts: 1 },
  ];
  assert.deepEqual(
    sortIngestFeeds(feeds).map((f) => f.name),
    ["BBC", "Reuters", "NYT"],
  );
});

test("FEED_MS is an 8s abort so one hung feed cannot stall the tape", () => {
  assert.equal(FEED_MS, 8_000);
  assert.equal(FEED_MS < 30_000, true);
  assert.equal(FEED_MS > 1_000, true);
});
