import assert from "node:assert/strict";
import { test } from "node:test";
import { cacheSet } from "./cache";
import {
  CATALOG_KEY,
  CATALOG_MS,
  UA,
  catalogCacheHit,
  loadPublicApiCatalog,
  parsePublicApisReadme,
} from "./public-apis";
import type { PublicApiEntry } from "./public-apis";

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

test("catalogCacheHit treats empty/missing as a miss so [] cannot lock the tape", () => {
  const row: PublicApiEntry = {
    name: "Dog API",
    description: "Dogs",
    auth: "No",
    https: true,
    cors: "Yes",
    category: "Animals",
    url: "https://dog.ceo",
  };
  assert.equal(catalogCacheHit([row]), true);
  assert.equal(catalogCacheHit([]), false);
  assert.equal(catalogCacheHit(undefined), false);
  assert.equal(catalogCacheHit(null), false);
});

test("CATALOG_MS is 12s and is not the 8s per-feed abort", () => {
  assert.equal(CATALOG_MS, 12_000);
  assert.equal(CATALOG_MS === 8_000, false);
  assert.equal(UA.startsWith("HawkxAI/1.0"), true);
});

test("loadPublicApiCatalog throws catalog status, misses empty cache, and skips fetch on a hit", async () => {
  const orig = globalThis.fetch;
  const catalogUrl =
    "https://raw.githubusercontent.com/public-apis/public-apis/master/README.md";
  try {
    cacheSet(CATALOG_KEY, []);
    globalThis.fetch = (async () => new Response("nope", { status: 503 })) as typeof fetch;
    await assert.rejects(() => loadPublicApiCatalog(), { message: "public-apis catalog 503" });

    let emptyMissCalls = 0;
    cacheSet(CATALOG_KEY, []);
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      emptyMissCalls += 1;
      assert.equal(String(input), catalogUrl);
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("Accept"), "text/plain");
      assert.equal(headers.get("User-Agent"), UA);
      assert.equal(init?.cache, "no-store");
      return new Response("not found", { status: 404 });
    }) as typeof fetch;
    await assert.rejects(() => loadPublicApiCatalog(), { message: "public-apis catalog 404" });
    assert.equal(emptyMissCalls, 1);

    cacheSet(CATALOG_KEY, []);
    globalThis.fetch = (async () => new Response(README, { status: 200 })) as typeof fetch;
    const loaded = await loadPublicApiCatalog();
    assert.deepEqual(
      loaded.map((e) => e.name),
      ["Dog API", "Cat API", "CoinGecko", "Secret Ledger"],
    );
    assert.equal(
      loaded.some((e) => e.url.includes("githubusercontent.com")),
      false,
    );

    let hitCalls = 0;
    globalThis.fetch = (async () => {
      hitCalls += 1;
      return new Response("nope", { status: 503 });
    }) as typeof fetch;
    const cached = await loadPublicApiCatalog();
    assert.equal(cached[0]?.name, "Dog API");
    assert.equal(hitCalls, 0);
  } finally {
    globalThis.fetch = orig;
  }
});
