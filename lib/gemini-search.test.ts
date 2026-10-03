import assert from "node:assert/strict";
import { test } from "node:test";
import { geminiDeepResearch, geminiSearch } from "./gemini";

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

test("geminiSearch and geminiDeepResearch send Google Search and never invent a URL", async () => {
  const bodies: Record<string, unknown>[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "Named source: NHTSA recall bulletin." }] } }],
      }),
      text: async () => "",
    } as Response;
  }) as typeof fetch;
  try {
    await withEnv("GOOGLE_API_KEY", "coverage-gemini-search-key", async () => {
      await withEnv("GEMINI_API_KEY", undefined, async () => {
        assert.equal(await geminiSearch("Camry"), "Named source: NHTSA recall bulletin.");
        assert.equal(await geminiDeepResearch("Camry"), "Named source: NHTSA recall bulletin.");
      });
    });
    assert.equal(bodies.length, 2);
    for (const body of bodies) {
      assert.deepEqual(body.tools, [{ google_search: {} }]);
      const system = body.systemInstruction as { parts?: { text?: string }[] };
      assert.match(system.parts?.[0]?.text ?? "", /Use Google Search/);
      assert.match(system.parts?.[0]?.text ?? "", /Never invent/);
      const config = body.generationConfig as { responseMimeType?: string };
      assert.equal(config.responseMimeType, undefined);
    }
  } finally {
    globalThis.fetch = orig;
  }
});
