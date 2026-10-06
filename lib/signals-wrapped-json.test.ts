import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchX } from "./signals";

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

function envelope(text: string): Response {
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
    text: async () => "",
  } as Response;
}

test("fetchX leftover extracts a JSON object wrapped in Sure-prefix and does not invent extra URLs", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = (async () =>
    envelope(
      `Sure, here is the footprint.\n{"topics":[{"topic":"Camry wrap thread","volume":20,"urls":["https://x.com/camry/status/9"]}]}`,
    )) as typeof fetch;
  try {
    await withEnv("GOOGLE_API_KEY", "coverage-fetchx-wrap-key", async () => {
      await withEnv("GEMINI_API_KEY", undefined, async () => {
        const posts = await fetchX(undefined, "Camry");
        assert.equal(posts.length, 1);
        assert.equal(posts[0]?.title, "Camry wrap thread");
        assert.equal(posts[0]?.url, "https://x.com/camry/status/9");
        assert.equal(posts[0]?.score, 20);
        assert.equal(posts[0]?.platform, "x");
        assert.equal(posts[0]?.tool, "collect_x");
        assert.ok(posts[0]?.collectedAt);
        assert.equal(
          posts.some((p) => /sure|invent/i.test(p.title)),
          false,
        );
      });
    });
  } finally {
    globalThis.fetch = orig;
  }
});
