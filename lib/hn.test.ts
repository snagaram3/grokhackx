import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchHn, searchHn } from "./hn";

function jsonRes(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => data,
  } as Response;
}

async function withFetch(
  impl: (url: string) => Response,
  fn: () => Promise<void>,
): Promise<void> {
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => impl(String(input))) as typeof fetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = orig;
  }
}

test("fetchHn drops dead and deleted stories and falls back to the item URL", async () => {
  const orig = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("topstories")) return jsonRes([101, 102, 103, 104]);
    if (url.includes("/101.json")) {
      return jsonRes({ id: 101, title: "Dead story", dead: true, score: 99, time: 1 });
    }
    if (url.includes("/102.json")) {
      return jsonRes({ id: 102, title: "Deleted story", deleted: true, score: 88, time: 1 });
    }
    if (url.includes("/103.json")) return jsonRes(null, false, 404);
    if (url.includes("/104.json")) {
      return jsonRes({ id: 104, title: "Live story", score: 10, time: 0 });
    }
    return jsonRes(null, false, 404);
  }) as typeof fetch;
  try {
    const posts = await fetchHn(60);
    assert.equal(posts.length, 1);
    assert.equal(posts[0]?.title, "Live story");
    assert.equal(posts[0]?.url, "https://news.ycombinator.com/item?id=104");
    assert.equal(posts[0]?.platform, "hn");
    assert.equal(posts[0]?.score, 10);
    assert.equal(posts[0]?.createdAt, "1970-01-01T00:00:00.000Z");
    assert.equal(posts[0]?.tool, "collect_hn");
    assert.ok(posts[0]?.collectedAt);
    assert.ok(calls.every((url) => !url.includes("algolia")));
  } finally {
    globalThis.fetch = orig;
  }
});

test("fetchHn throws when topstories is not ok and does not invent stories", async () => {
  await withFetch(() => jsonRes(null, false, 503), async () => {
    await assert.rejects(() => fetchHn(), /hn topstories 503/);
  });
});

test("searchHn leftover blank query uses the topstories path, not Algolia", async () => {
  const orig = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("topstories")) return jsonRes([9]);
    if (url.includes("/9.json")) {
      return jsonRes({
        id: 9,
        title: "World tape",
        url: "https://news.ycombinator.com/item?id=9",
        score: 4,
        time: 1,
      });
    }
    return jsonRes(null, false, 404);
  }) as typeof fetch;
  try {
    const posts = await searchHn("   ");
    assert.equal(posts.length, 1);
    assert.equal(posts[0]?.title, "World tape");
    assert.ok(calls.some((url) => url.includes("topstories")));
    assert.ok(calls.every((url) => !url.includes("algolia")));
  } finally {
    globalThis.fetch = orig;
  }
});

test("searchHn maps Algolia hits, drops untitled crumbs, and throws on HTTP failure", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("algolia.com") && url.includes("Camry")) {
      return jsonRes({
        hits: [
          { title: "Camry thread", objectID: "5", points: 3, created_at: "2026-08-26T12:00:00.000Z" },
          { title: "", objectID: "6", points: 9 },
          { objectID: "7", points: 12 },
        ],
      });
    }
    if (url.includes("algolia.com")) return jsonRes(null, false, 502);
    return jsonRes(null, false, 404);
  }) as typeof fetch;
  try {
    const posts = await searchHn("Camry");
    assert.equal(posts.length, 1);
    assert.equal(posts[0]?.title, "Camry thread");
    assert.equal(posts[0]?.url, "https://news.ycombinator.com/item?id=5");
    assert.equal(posts[0]?.score, 3);
    assert.equal(posts[0]?.createdAt, "2026-08-26T12:00:00.000Z");
    assert.equal(posts[0]?.tool, "collect_hn");
    await assert.rejects(() => searchHn("Tesla"), /hn search 502/);
  } finally {
    globalThis.fetch = orig;
  }
});
