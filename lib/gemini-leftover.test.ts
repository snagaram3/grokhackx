import assert from "node:assert/strict";
import { test } from "node:test";
import { geminiChat, geminiJson } from "./gemini";

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

test("geminiChat unwraps a fenced JSON envelope and throws on empty or HTTP failure", async () => {
  const orig = globalThis.fetch;
  try {
    await withEnv("GOOGLE_API_KEY", "coverage-gemini-key", async () => {
      await withEnv("GEMINI_API_KEY", undefined, async () => {
        globalThis.fetch = (async () => envelope('```json\n{"ok":true}\n```')) as typeof fetch;
        assert.equal(await geminiChat("ping"), '{"ok":true}');

        globalThis.fetch = (async () =>
          ({
            ok: true,
            json: async () => ({ candidates: [{ content: { parts: [] } }] }),
            text: async () => "",
          }) as Response) as typeof fetch;
        await assert.rejects(() => geminiChat("empty"), /gemini empty/);

        globalThis.fetch = (async () =>
          ({
            ok: false,
            status: 500,
            text: async () => "boom",
            json: async () => ({}),
          }) as Response) as typeof fetch;
        await assert.rejects(() => geminiChat("fail"), /gemini 500/);
      });
    });
  } finally {
    globalThis.fetch = orig;
  }
});

test("geminiJson retries once when the first envelope fails parse", async () => {
  const orig = globalThis.fetch;
  let n = 0;
  globalThis.fetch = (async () => {
    n += 1;
    if (n === 1) return envelope("not-json");
    return envelope('{"ok":true}');
  }) as typeof fetch;
  try {
    await withEnv("GOOGLE_API_KEY", "coverage-gemini-json-key", async () => {
      await withEnv("GEMINI_API_KEY", undefined, async () => {
        const parsed = await geminiJson("classify", (raw) => {
          const value = JSON.parse(raw) as { ok?: boolean };
          if (!value.ok) throw new Error("missing ok");
          return value;
        });
        assert.deepEqual(parsed, { ok: true });
        assert.equal(n, 2);
      });
    });
  } finally {
    globalThis.fetch = orig;
  }
});
