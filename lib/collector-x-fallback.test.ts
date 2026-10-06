import assert from "node:assert/strict";
import { test } from "node:test";
import { collectXSource } from "./agents";
import { geoAgent } from "./geo";

function rss(title: string, href: string): string {
  return `<?xml version="1.0"?><rss><channel><item><title>${title}</title><link>${href}</link></item></channel></rss>`;
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

test("collectXSource leftover with no Google key uses Trends RSS and never stamps it as X", async () => {
  const orig = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    if (!url.includes("trends.google.com/trending/rss")) {
      throw new Error(`unexpected ${url}`);
    }
    return {
      ok: true,
      text: async () =>
        rss("Camry hybrid JP", "https://trends.google.com/trending/explore?q=Camry&amp;geo=JP"),
    } as Response;
  }) as typeof fetch;
  try {
    await withEnv("GOOGLE_API_KEY", undefined, async () => {
      await withEnv("GEMINI_API_KEY", undefined, async () => {
        const result = await collectXSource(geoAgent("tokyo"), "Camry");
        assert.equal(result.source, "x");
        assert.equal(result.ok, false);
        assert.equal(result.count, 0);
        assert.deepEqual(result.posts, []);
        assert.equal(result.fallback, "google trends");
        assert.equal(result.fallbackPosts?.length, 1);
        assert.equal(result.fallbackPosts?.[0]?.title, "Camry hybrid JP");
        assert.equal(
          result.fallbackPosts?.[0]?.url,
          "https://trends.google.com/trending/explore?q=Camry&geo=JP",
        );
        assert.equal(result.fallbackPosts?.[0]?.platform, "public");
        assert.equal(result.fallbackPosts?.[0]?.sourceApi, "google-trends");
        assert.equal(result.fallbackPosts?.[0]?.tool, "collect_google_trends");
        assert.ok(result.fallbackPosts?.[0]?.collectedAt);
        assert.equal(
          urls.some((u) => u.includes("generativelanguage.googleapis.com")),
          false,
        );
        assert.deepEqual(
          urls.map((u) => new URL(u).searchParams.get("geo")),
          ["JP"],
        );
      });
    });
  } finally {
    globalThis.fetch = orig;
  }
});

test("collectXSource leftover empty Trends RSS does not invent an X tape or a fallback", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (!url.includes("trends.google.com/trending/rss")) {
      throw new Error(`unexpected ${url}`);
    }
    return { ok: false, status: 503, text: async () => "down" } as Response;
  }) as typeof fetch;
  try {
    await withEnv("GOOGLE_API_KEY", undefined, async () => {
      await withEnv("GEMINI_API_KEY", undefined, async () => {
        const result = await collectXSource(geoAgent("tokyo"), "Camry");
        assert.equal(result.source, "x");
        assert.equal(result.ok, false);
        assert.equal(result.count, 0);
        assert.deepEqual(result.posts, []);
        assert.equal(result.fallback, undefined);
        assert.equal(result.fallbackPosts, undefined);
      });
    });
  } finally {
    globalThis.fetch = orig;
  }
});

test("collectXSource leftover Gemini throw still falls back to Trends and does not keep failed X posts", async () => {
  const orig = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("generativelanguage.googleapis.com")) {
      return { ok: false, status: 500, text: async () => "gemini down" } as Response;
    }
    if (url.includes("trends.google.com/trending/rss")) {
      return {
        ok: true,
        text: async () =>
          rss("Camry recall GB", "https://trends.google.com/trending/explore?q=Camry&amp;geo=GB"),
      } as Response;
    }
    throw new Error(`unexpected ${url}`);
  }) as typeof fetch;
  try {
    await withEnv("GOOGLE_API_KEY", "coverage-collectx-throw-key", async () => {
      await withEnv("GEMINI_API_KEY", undefined, async () => {
        const result = await collectXSource(geoAgent("all"), "Camry");
        assert.equal(result.ok, false);
        assert.deepEqual(result.posts, []);
        assert.equal(result.fallback, "google trends");
        assert.equal(result.fallbackPosts?.[0]?.title, "Camry recall GB");
        assert.equal(result.fallbackPosts?.[0]?.platform, "public");
        assert.equal(result.fallbackPosts?.[0]?.tool, "collect_google_trends");
        assert.ok(urls.some((u) => u.includes("generativelanguage.googleapis.com")));
        assert.ok(urls.some((u) => u.includes("trends.google.com/trending/rss")));
      });
    });
  } finally {
    globalThis.fetch = orig;
  }
});
