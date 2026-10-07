import assert from "node:assert/strict";
import { test } from "node:test";
import { searchHn } from "./hn";

test("searchHn uses the HN item URL when Algolia omits url and does not invent a story href", async () => {
  const orig = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    assert.ok(url.includes("hn.algolia.com"));
    assert.ok(url.includes("CoverageHnItemUrlCamryZz"));
    return {
      ok: true,
      json: async () => ({
        hits: [
          {
            title: "Camry hybrid thread",
            objectID: "424242",
            points: 12,
            created_at: "2026-08-26T12:00:00.000Z",
          },
          {
            title: "Camry recall",
            url: "https://www.nhtsa.gov/camry",
            objectID: "99",
            points: 8,
            created_at: "2026-08-26T11:00:00.000Z",
          },
        ],
      }),
    } as Response;
  }) as typeof fetch;
  try {
    const posts = await searchHn("CoverageHnItemUrlCamryZz");
    assert.equal(posts.length, 2);
    assert.equal(posts[0]?.url, "https://news.ycombinator.com/item?id=424242");
    assert.equal(posts[1]?.url, "https://www.nhtsa.gov/camry");
    assert.ok(posts.every((p) => p.tool === "collect_hn"));
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = orig;
  }
});

test("searchHn missing hits is an empty tape and does not invent stories", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = (async () =>
    ({
      ok: true,
      json: async () => ({}),
    }) as Response) as typeof fetch;
  try {
    const posts = await searchHn("CoverageHnEmptyHitsCamryZz");
    assert.deepEqual(posts, []);
  } finally {
    globalThis.fetch = orig;
  }
});
