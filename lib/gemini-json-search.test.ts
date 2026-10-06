import assert from "node:assert/strict";
import { test } from "node:test";
import { geminiJson } from "./gemini";

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

type GeminiBody = {
  tools?: unknown[];
  generationConfig?: { responseMimeType?: string };
  systemInstruction?: { parts?: { text?: string }[] };
};

test("geminiJson leftover search=true first-parse success sends google_search and does not retry", async () => {
  const orig = globalThis.fetch;
  const bodies: GeminiBody[] = [];
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body ?? "{}")) as GeminiBody);
    return envelope('{"ok":true,"id":"camry-search"}');
  }) as typeof fetch;
  try {
    await withEnv("GOOGLE_API_KEY", "coverage-gemini-json-search-key", async () => {
      await withEnv("GEMINI_API_KEY", undefined, async () => {
        const parsed = await geminiJson(
          "classify Camry",
          (raw) => {
            const value = JSON.parse(raw) as { ok?: boolean; id?: string };
            if (!value.ok) throw new Error("missing ok");
            return value;
          },
          true,
        );
        assert.deepEqual(parsed, { ok: true, id: "camry-search" });
        assert.equal(bodies.length, 1);
        assert.deepEqual(bodies[0]?.tools, [{ google_search: {} }]);
        assert.equal(bodies[0]?.generationConfig?.responseMimeType, undefined);
        assert.match(bodies[0]?.systemInstruction?.parts?.[0]?.text ?? "", /Use Google Search/);
      });
    });
  } finally {
    globalThis.fetch = orig;
  }
});

test("geminiJson leftover search=true parse fail retries once via json mime without search tools", async () => {
  const orig = globalThis.fetch;
  const bodies: GeminiBody[] = [];
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body ?? "{}")) as GeminiBody);
    if (bodies.length === 1) return envelope("not-json");
    return envelope('{"ok":true,"id":"camry-retry"}');
  }) as typeof fetch;
  try {
    await withEnv("GOOGLE_API_KEY", "coverage-gemini-json-search-retry-key", async () => {
      await withEnv("GEMINI_API_KEY", undefined, async () => {
        const parsed = await geminiJson(
          "classify Camry",
          (raw) => {
            const value = JSON.parse(raw) as { ok?: boolean; id?: string };
            if (!value.ok) throw new Error("missing ok");
            return value;
          },
          true,
        );
        assert.deepEqual(parsed, { ok: true, id: "camry-retry" });
        assert.equal(bodies.length, 2);
        assert.deepEqual(bodies[0]?.tools, [{ google_search: {} }]);
        assert.equal(bodies[0]?.generationConfig?.responseMimeType, undefined);
        assert.equal(bodies[1]?.tools, undefined);
        assert.equal(bodies[1]?.generationConfig?.responseMimeType, "application/json");
      });
    });
  } finally {
    globalThis.fetch = orig;
  }
});
