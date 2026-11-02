import assert from "node:assert/strict";
import { test } from "node:test";
import { JSON_ACCEPT, getJson, parsePublicApisReadme } from "./public-apis";

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

test("JSON_ACCEPT is JSON (not RSS) and still allows text/plain bodies", () => {
  assert.equal(JSON_ACCEPT, "application/json, text/plain, */*");
  assert.equal(JSON_ACCEPT.includes("application/json"), true);
  assert.equal(JSON_ACCEPT.includes("text/plain"), true);
  assert.equal(JSON_ACCEPT.includes("application/rss+xml"), false);
  assert.equal(JSON_ACCEPT.includes("application/atom+xml"), false);
  assert.notEqual(JSON_ACCEPT, "text/plain");
});

test("getJson asks for JSON, stamps HawkxAI, and parses a 200 object", async () => {
  const orig = globalThis.fetch;
  const url = "https://api.test/feed.json";
  try {
    let calls = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      assert.equal(String(input), url);
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("Accept"), JSON_ACCEPT);
      assert.equal((headers.get("User-Agent") ?? "").startsWith("HawkxAI/1.0"), true);
      assert.equal(init?.cache, "no-store");
      assert.equal(init?.signal instanceof AbortSignal, true);
      return new Response(JSON.stringify({ ok: true, id: "btc" }), { status: 200 });
    }) as typeof fetch;
    const got = await getJson(url, 50);
    assert.deepEqual(got, { ok: true, id: "btc" });
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = orig;
  }
});

test("getJson !ok throws url + status and does not invent a feed URL", async () => {
  const orig = globalThis.fetch;
  const url = "https://api.test/feed.json";
  try {
    globalThis.fetch = (async () => new Response("nope", { status: 503 })) as typeof fetch;
    await assert.rejects(() => getJson(url, 50), { message: `${url} 503` });

    globalThis.fetch = (async () => new Response("missing", { status: 404 })) as typeof fetch;
    await assert.rejects(() => getJson(url, 50), { message: `${url} 404` });
  } finally {
    globalThis.fetch = orig;
  }
});
