import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchGoogleTrends, fetchGoogleTrendsSafe, fetchX } from "./signals";

function rss(title: string, href: string): string {
  return `<?xml version="1.0"?><rss><channel><item><title>${title}</title><link>${href}</link></item></channel></rss>`;
}

function envelope(text: string): Response {
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
    text: async () => "",
  } as Response;
}

function withEnv(key: string, value: string | undefined, fn: () => Promise<void> | void) {
  const prev = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  const restore = () => {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  };
  try {
    const out = fn();
    if (out && typeof (out as Promise<void>).then === "function") {
      return (out as Promise<void>).finally(restore);
    }
  } catch (err) {
    restore();
    throw err;
  }
  restore();
}

test("fetchGoogleTrends leftover tokyo hits JP only and stamps google-trends", async () => {
  const orig = globalThis.fetch;
  const geos: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    const geo = new URL(url).searchParams.get("geo") ?? "";
    geos.push(geo);
    if (!url.includes("trends.google.com/trending/rss")) {
      throw new Error(`unexpected ${url}`);
    }
    return {
      ok: true,
      text: async () =>
        rss("Camry hybrid", "https://trends.google.com/trending/explore?q=Camry&amp;geo=JP"),
    } as Response;
  }) as typeof fetch;
  try {
    const posts = await fetchGoogleTrends("tokyo");
    assert.deepEqual(geos, ["JP"]);
    assert.equal(posts.length, 1);
    assert.equal(posts[0]?.title, "Camry hybrid");
    assert.equal(posts[0]?.url, "https://trends.google.com/trending/explore?q=Camry&geo=JP");
    assert.equal(posts[0]?.platform, "public");
    assert.equal(posts[0]?.sourceApi, "google-trends");
    assert.equal(posts[0]?.tool, "collect_google_trends");
    assert.ok(posts[0]?.collectedAt);
  } finally {
    globalThis.fetch = orig;
  }
});

test("fetchGoogleTrends leftover keeps a live geo when another RSS is 503 and does not invent the failed geo", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    const geo = new URL(url).searchParams.get("geo");
    if (geo === "US") return { ok: false, status: 503, text: async () => "down" } as Response;
    if (geo === "GB") {
      return {
        ok: true,
        text: async () =>
          rss("Camry UK", "https://trends.google.com/trending/explore?q=Camry&amp;geo=GB"),
      } as Response;
    }
    return { ok: false, status: 404, text: async () => "empty" } as Response;
  }) as typeof fetch;
  try {
    const posts = await fetchGoogleTrends("all", "Camry");
    assert.equal(posts.length, 1);
    assert.equal(posts[0]?.title, "Camry UK");
    assert.equal(posts[0]?.url, "https://trends.google.com/trending/explore?q=Camry&geo=GB");
    assert.equal(
      posts.some((p) => /US/i.test(p.url) || p.title.includes("invent")),
      false,
    );
  } finally {
    globalThis.fetch = orig;
  }
});

test("fetchGoogleTrends leftover all-geo failure is empty, and Safe swallows a throw", async () => {
  const orig = globalThis.fetch;
  try {
    globalThis.fetch = (async () => ({ ok: false, status: 503, text: async () => "down" }) as Response) as typeof fetch;
    const empty = await fetchGoogleTrends("tokyo");
    assert.deepEqual(empty, []);

    globalThis.fetch = (async () => {
      throw new Error("rss socket reset");
    }) as typeof fetch;
    const safe = await fetchGoogleTrendsSafe("tokyo");
    assert.deepEqual(safe, []);
  } finally {
    globalThis.fetch = orig;
  }
});

test("fetchX leftover maps Gemini topics, clamps volume, and defaults a missing url to x.com", async () => {
  const orig = globalThis.fetch;
  let body: { tools?: unknown[]; generationConfig?: { responseMimeType?: string } } | null = null;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    body = JSON.parse(String(init?.body ?? "{}")) as typeof body;
    return envelope(
      JSON.stringify({
        topics: [
          { topic: "Camry hybrid thread", volume: 140, urls: ["https://x.com/camry/status/1"] },
          { topic: "Camry no-url", volume: 12 },
        ],
      }),
    );
  }) as typeof fetch;
  try {
    await withEnv("GOOGLE_API_KEY", "coverage-fetchx-key", async () => {
      await withEnv("GEMINI_API_KEY", undefined, async () => {
        const posts = await fetchX(undefined, "Camry");
        assert.equal(posts.length, 2);
        assert.equal(posts[0]?.title, "Camry hybrid thread");
        assert.equal(posts[0]?.url, "https://x.com/camry/status/1");
        assert.equal(posts[0]?.score, 100);
        assert.equal(posts[0]?.platform, "x");
        assert.equal(posts[0]?.tool, "collect_x");
        assert.equal(posts[1]?.title, "Camry no-url");
        assert.equal(posts[1]?.url, "https://x.com");
        assert.equal(posts[1]?.score, 12);
        assert.deepEqual(body?.tools, [{ google_search: {} }]);
        assert.equal(body?.generationConfig?.responseMimeType, undefined);
      });
    });
  } finally {
    globalThis.fetch = orig;
  }
});
