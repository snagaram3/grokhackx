import assert from "node:assert/strict";
import { test } from "node:test";
import { geminiJson, hasGoogleKey } from "./gemini";

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

test("hasGoogleKey leftover is false with both keys unset and true with a dummy Google key", () => {
  const prevGoogle = process.env.GOOGLE_API_KEY;
  const prevGemini = process.env.GEMINI_API_KEY;
  try {
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GEMINI_API_KEY;
    assert.equal(hasGoogleKey(), false);
    process.env.GOOGLE_API_KEY = "coverage-has-google-key";
    assert.equal(hasGoogleKey(), true);
  } finally {
    if (prevGoogle === undefined) delete process.env.GOOGLE_API_KEY;
    else process.env.GOOGLE_API_KEY = prevGoogle;
    if (prevGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevGemini;
  }
});

test("geminiJson leftover first-parse success does not retry", async () => {
  const orig = globalThis.fetch;
  let n = 0;
  globalThis.fetch = (async () => {
    n += 1;
    return envelope('{"ok":true,"id":"camry"}');
  }) as typeof fetch;
  try {
    await withEnv("GOOGLE_API_KEY", "coverage-gemini-first-key", async () => {
      await withEnv("GEMINI_API_KEY", undefined, async () => {
        const parsed = await geminiJson("classify", (raw) => {
          const value = JSON.parse(raw) as { ok?: boolean; id?: string };
          if (!value.ok) throw new Error("missing ok");
          return value;
        });
        assert.deepEqual(parsed, { ok: true, id: "camry" });
        assert.equal(n, 1);
      });
    });
  } finally {
    globalThis.fetch = orig;
  }
});
