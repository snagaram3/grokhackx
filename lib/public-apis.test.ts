import assert from "node:assert/strict";
import { test } from "node:test";
import { openLibraryFallbackUrl, parsePublicApisReadme } from "./public-apis";

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

test("openLibraryFallbackUrl is language:eng at limit=8, already encoded", () => {
  const url = openLibraryFallbackUrl();
  assert.equal(url, "https://openlibrary.org/search.json?q=language%3Aeng&limit=8");
  assert.equal(url.includes("language:eng"), false);
  assert.equal(url.includes("trending/daily"), false);
  assert.equal(url.includes("limit=10"), false);
});
