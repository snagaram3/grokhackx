import assert from "node:assert/strict";
import { test } from "node:test";
import { searchReddit } from "./reddit";

function listing(title: string, permalink: string, ups: number) {
  return JSON.stringify({
    data: {
      children: [
        {
          data: {
            title,
            permalink,
            ups,
            created_utc: 0,
          },
        },
      ],
    },
  });
}

test("searchReddit leftover HTML-block falls back to official listing and does not invent search posts", async () => {
  const prevPath = process.env.PATH;
  process.env.PATH = "/tmp/coverage-no-curl";
  const orig = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("search.json") && url.includes("Camry")) {
      return { ok: true, text: async () => "  <html><h1>blocked</h1></html>" } as Response;
    }
    if (url.includes("/r/worldnews/hot.json")) {
      return {
        ok: true,
        text: async () => listing("Camry official thread", "/r/worldnews/comments/1/camry", 9),
      } as Response;
    }
    throw new Error(`reddit leftover offline ${url}`);
  }) as typeof fetch;
  try {
    const posts = await searchReddit("Camry");
    assert.equal(posts.length, 1);
    assert.equal(posts[0]?.title, "Camry official thread");
    assert.equal(posts[0]?.url, "https://www.reddit.com/r/worldnews/comments/1/camry");
    assert.equal(posts[0]?.score, 9);
    assert.equal(posts[0]?.platform, "reddit");
    assert.equal(posts[0]?.tool, "collect_reddit");
    assert.ok(posts[0]?.collectedAt);
    assert.equal(posts[0]?.createdAt, "1970-01-01T00:00:00.000Z");
    assert.ok(calls.some((u) => u.includes("search.json")));
    assert.ok(calls.some((u) => u.includes("/r/worldnews/hot.json")));
    assert.equal(
      posts.some((p) => /invent|blocked/i.test(p.title)),
      false,
    );
  } finally {
    globalThis.fetch = orig;
    process.env.PATH = prevPath;
  }
});

test("searchReddit leftover empty listing falls back to official and does not invent a search tape", async () => {
  const prevPath = process.env.PATH;
  process.env.PATH = "/tmp/coverage-no-curl";
  const orig = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("search.json") && url.includes("Camry")) {
      return { ok: true, text: async () => JSON.stringify({ data: { children: [] } }) } as Response;
    }
    if (url.includes("/r/worldnews/hot.json")) {
      return {
        ok: true,
        text: async () => listing("Camry empty-search fallback", "/r/worldnews/comments/2/camry", 3),
      } as Response;
    }
    throw new Error(`reddit leftover offline ${url}`);
  }) as typeof fetch;
  try {
    const posts = await searchReddit("Camry");
    assert.equal(posts.length, 1);
    assert.equal(posts[0]?.title, "Camry empty-search fallback");
    assert.equal(posts[0]?.url, "https://www.reddit.com/r/worldnews/comments/2/camry");
    assert.equal(posts[0]?.tool, "collect_reddit");
    assert.ok(calls.some((u) => u.includes("search.json")));
    assert.ok(calls.some((u) => u.includes("/r/worldnews/hot.json")));
  } finally {
    globalThis.fetch = orig;
    process.env.PATH = prevPath;
  }
});
