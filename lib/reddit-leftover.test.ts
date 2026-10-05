import assert from "node:assert/strict";
import { test } from "node:test";
import { parseArctic, searchReddit } from "./reddit";

test("parseArctic leftover drops stickied rows, prefers permalink, and throws when empty", () => {
  const posts = parseArctic({
    data: [
      {
        title: "Stickied rules",
        permalink: "/r/cars/comments/1/rules",
        url: "https://www.reddit.com/r/cars/",
        stickied: true,
        ups: 999,
        created_utc: 1,
      },
      {
        title: "Camry thread",
        permalink: "/r/cars/comments/1/camry",
        url: "https://out.example/camry",
        ups: 12,
        created_utc: 0,
      },
      {
        title: "No permalink",
        url: "https://old.reddit.com/r/cars/comments/2/leaf",
        score: 7,
        created_utc: 0,
      },
      { permalink: "/r/cars/comments/3/untitled" },
    ],
  });
  assert.deepEqual(
    posts.map((p) => ({ title: p.title, url: p.url, score: p.score })),
    [
      {
        title: "Camry thread",
        url: "https://www.reddit.com/r/cars/comments/1/camry",
        score: 12,
      },
      {
        title: "No permalink",
        url: "https://old.reddit.com/r/cars/comments/2/leaf",
        score: 7,
      },
    ],
  );
  assert.equal(posts[0]?.createdAt, "1970-01-01T00:00:00.000Z");
  assert.throws(() => parseArctic({ data: [] }), /arctic-shift empty/);
  assert.throws(() => parseArctic({}), /arctic-shift empty/);
});

test("searchReddit leftover listing success stamps collect_reddit and does not invent a fallback tape", async () => {
  const prevPath = process.env.PATH;
  process.env.PATH = "/tmp/coverage-no-curl";
  const orig = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("search.json") && url.includes("Camry")) {
      return {
        ok: true,
        text: async () =>
          JSON.stringify({
            data: {
              children: [
                {
                  data: {
                    title: "Camry thread",
                    permalink: "/r/cars/comments/1/camry",
                    ups: 4,
                    created_utc: 0,
                  },
                },
                { data: { permalink: "/r/cars/comments/2/untitled" } },
              ],
            },
          }),
      } as Response;
    }
    throw new Error(`unexpected ${url}`);
  }) as typeof fetch;
  try {
    const posts = await searchReddit("Camry");
    assert.equal(posts.length, 1);
    assert.equal(posts[0]?.title, "Camry thread");
    assert.equal(posts[0]?.url, "https://www.reddit.com/r/cars/comments/1/camry");
    assert.equal(posts[0]?.score, 4);
    assert.equal(posts[0]?.platform, "reddit");
    assert.equal(posts[0]?.tool, "collect_reddit");
    assert.ok(posts[0]?.collectedAt);
    assert.equal(posts[0]?.createdAt, "1970-01-01T00:00:00.000Z");
    assert.equal(calls.length, 1);
    assert.match(calls[0] ?? "", /search\.json/);
  } finally {
    globalThis.fetch = orig;
    process.env.PATH = prevPath;
  }
});

test("searchReddit leftover blank query does not invent posts when every subreddit is offline", async () => {
  const prevPath = process.env.PATH;
  process.env.PATH = "/tmp/coverage-no-curl";
  const orig = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("reddit leftover offline");
  }) as typeof fetch;
  try {
    await assert.rejects(() => searchReddit("   "), /reddit: all subreddits failed/);
  } finally {
    globalThis.fetch = orig;
    process.env.PATH = prevPath;
  }
});
