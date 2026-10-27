import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bskySearchOrHot,
  gdeltTapeFresh,
  gdeltUsesWorldCache,
  GDELT_TTL_MS,
  getText,
  nprNewsRssUrl,
  nytHomeRssUrl,
  parsePublicApisReadme,
  pickWikipediaTape,
  publicApiFeedNames,
  techCrunchFeedUrl,
  wikiTopicOrTape,
} from "./public-apis";
import type { Post } from "./types";

function publicPost(title: string, url = `https://a.test/${encodeURIComponent(title)}`): Post {
  return {
    platform: "public",
    title,
    url,
    score: 55,
    createdAt: "2026-08-26T12:00:00.000Z",
  };
}

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

test("nytHomeRssUrl is the homepage RSS, not World.xml or Google News", () => {
  const url = nytHomeRssUrl();
  assert.equal(url, "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml");
  assert.equal(url.includes("World.xml"), false);
  assert.equal(url.includes("news.google.com"), false);
  assert.equal(url.includes("site:nytimes.com"), false);
});

test("nprNewsRssUrl is feed 1001, not a program or Google News path", () => {
  const url = nprNewsRssUrl();
  assert.equal(url, "https://feeds.npr.org/1001/rss.xml");
  assert.equal(url.includes("/1003/"), false);
  assert.equal(url.includes("news.google.com"), false);
  assert.equal(url.includes("site:npr.org"), false);
});

test("techCrunchFeedUrl is the site feed, not /tag/ or Google News", () => {
  const url = techCrunchFeedUrl();
  assert.equal(url, "https://techcrunch.com/feed/");
  assert.equal(url.includes("/tag/"), false);
  assert.equal(url.includes("news.google.com"), false);
  assert.equal(url.includes("site:techcrunch.com"), false);
});

test("publicApiFeedNames still lists leftover static news RSS feeds", () => {
  const names = publicApiFeedNames();
  for (const name of ["NYT", "NPR", "TechCrunch", "Wikipedia", "Bluesky", "GDELT"]) {
    assert.equal(names.includes(name), true, name);
  }
});

test("pickWikipediaTape keeps the first non-empty batch and ignores later days", () => {
  const featured = [publicPost("Wikipedia: Camry", "https://en.wikipedia.org/wiki/Camry")];
  const pageviews = [publicPost("Wikipedia: Toyota", "https://en.wikipedia.org/wiki/Toyota")];
  const picked = pickWikipediaTape([[], featured, pageviews]);
  assert.equal(picked, featured);
  assert.equal(picked[0].title, "Wikipedia: Camry");
});

test("pickWikipediaTape throws Wikipedia empty and does not invent a wiki URL", () => {
  assert.throws(() => pickWikipediaTape([]), { message: "Wikipedia empty" });
  assert.throws(() => pickWikipediaTape([[], []]), { message: "Wikipedia empty" });
});

test("wikiTopicOrTape keeps OpenSearch hits and does not call the featured tape", async () => {
  const hits = [publicPost("Wikipedia: Camry", "https://en.wikipedia.org/wiki/Camry")];
  let tapeCalls = 0;
  const got = await wikiTopicOrTape(hits, async () => {
    tapeCalls += 1;
    return [publicPost("Wikipedia: Main Page", "https://en.wikipedia.org/wiki/Main_Page")];
  });
  assert.equal(got, hits);
  assert.equal(tapeCalls, 0);
});

test("wikiTopicOrTape topic-miss falls through to the tape instead of returning []", async () => {
  const tape = [publicPost("Wikipedia: Featured", "https://en.wikipedia.org/wiki/Featured")];
  const got = await wikiTopicOrTape([], async () => tape);
  assert.equal(got, tape);
  await assert.rejects(
    () => wikiTopicOrTape([], async () => pickWikipediaTape([])),
    { message: "Wikipedia empty" },
  );
});

test("bskySearchOrHot keeps search hits and does not mix in what's-hot", () => {
  const hits = [publicPost("Camry search hit")];
  const hot = [publicPost("unrelated what's-hot"), publicPost("Camryx trending")];
  const got = bskySearchOrHot(hits, hot, "Camry");
  assert.deepEqual(got.map((p) => p.title), ["Camry search hit"]);
});

test("bskySearchOrHot empty search falls through to what's-hot instead of []", () => {
  const hot = [
    publicPost("Camryx hybrid recall"),
    publicPost("camera sensor firmware"),
    publicPost("Toyota Camry automotive"),
  ];
  const filtered = bskySearchOrHot([], hot, "Camry");
  assert.deepEqual(
    filtered.map((p) => p.title),
    ["Camryx hybrid recall", "Toyota Camry automotive"],
  );
  assert.equal(
    filtered.some((p) => /camera/i.test(p.title)),
    false,
  );

  const world = bskySearchOrHot(
    [],
    Array.from({ length: 10 }, (_, i) => publicPost(`hot ${i}`)),
  );
  assert.equal(world.length, 8);
  assert.equal(world[0].title, "hot 0");
  assert.equal(
    bskySearchOrHot([], hot, "  ").map((p) => p.title).length,
    3,
  );
});

test("GDELT_TTL_MS is 10 minutes and gdeltTapeFresh is a strict future exp", () => {
  assert.equal(GDELT_TTL_MS, 10 * 60_000);
  assert.notEqual(GDELT_TTL_MS, 5 * 60_000);
  assert.notEqual(GDELT_TTL_MS, 24 * 60 * 60_000);
  const now = 1_000_000;
  assert.equal(gdeltTapeFresh(now + 1, now), true);
  assert.equal(gdeltTapeFresh(now, now), false);
  assert.equal(gdeltTapeFresh(now - 1, now), false);
  assert.equal(gdeltTapeFresh(now + GDELT_TTL_MS, now), true);
});

test("gdeltUsesWorldCache only for empty topic — Camry bypasses the 10min tape", () => {
  assert.equal(gdeltUsesWorldCache("Camry"), false);
  assert.equal(gdeltUsesWorldCache("  Toyota Camry  "), false);
  assert.equal(gdeltUsesWorldCache(undefined), true);
  assert.equal(gdeltUsesWorldCache(""), true);
  assert.equal(gdeltUsesWorldCache("  "), true);
});

test("getText throws url + status on !ok and does not apply the JSON 429-body gate", async () => {
  const orig = globalThis.fetch;
  const npr = nprNewsRssUrl();
  try {
    globalThis.fetch = (async () => new Response("nope", { status: 503 })) as typeof fetch;
    await assert.rejects(() => getText(npr, 50), { message: `${npr} 503` });

    globalThis.fetch = (async () => new Response("rate limit requests exceeded", { status: 200 })) as typeof fetch;
    assert.equal(await getText(npr, 50), "rate limit requests exceeded");

    let accept = "";
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      accept = headers.get("Accept") ?? "";
      return new Response("<rss></rss>", { status: 200 });
    }) as typeof fetch;
    assert.equal(await getText(npr, 50), "<rss></rss>");
    assert.equal(accept.includes("application/rss+xml"), true);
    assert.equal(accept.includes("application/json"), false);
  } finally {
    globalThis.fetch = orig;
  }
});
