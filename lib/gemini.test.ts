import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GEMINI_BASE,
  GEMINI_MODEL_DEFAULT,
  SEARCH_TIMEOUT_MS,
  TIMEOUT_MS,
  geminiChat,
} from "./gemini";

function withEnv(overrides: Record<string, string | undefined>, fn: () => Promise<void>) {
  const prev: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(overrides)) {
    prev[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return fn().finally(() => {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

function envelope(parts: { text?: string }[], extra: { error?: { message?: string } } = {}): Response {
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts } }],
      ...extra,
    }),
    text: async () => "",
  } as Response;
}

test("chat times out at 55s, search at 90s, and the default model stays Flash on v1beta", () => {
  assert.equal(TIMEOUT_MS, 55_000);
  assert.equal(SEARCH_TIMEOUT_MS, 90_000);
  assert.ok(SEARCH_TIMEOUT_MS > TIMEOUT_MS);
  assert.equal(GEMINI_MODEL_DEFAULT, "gemini-3.5-flash");
  assert.equal(GEMINI_BASE, "https://generativelanguage.googleapis.com/v1beta");
});

test("geminiChat without a key throws and does not invent a completion", async () => {
  const orig = globalThis.fetch;
  let called = 0;
  globalThis.fetch = (async () => {
    called += 1;
    return envelope([{ text: "invented" }]);
  }) as typeof fetch;
  try {
    await withEnv({ GOOGLE_API_KEY: undefined, GEMINI_API_KEY: undefined }, async () => {
      await assert.rejects(() => geminiChat("Camry"), /GOOGLE_API_KEY missing/);
    });
    assert.equal(called, 0);
  } finally {
    globalThis.fetch = orig;
  }
});

test("geminiChat posts JSON to v1beta Flash and does not attach search tools", async () => {
  const orig = globalThis.fetch;
  let url = "";
  let method = "";
  let body: Record<string, unknown> = {};
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    url = String(input);
    method = String(init?.method ?? "");
    body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return envelope([{ text: "ok" }]);
  }) as typeof fetch;
  try {
    await withEnv({ GOOGLE_API_KEY: "coverage-gemini-key", GEMINI_API_KEY: undefined }, async () => {
      assert.equal(await geminiChat("Camry"), "ok");
    });
    assert.equal(method, "POST");
    assert.match(url, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/[^/]+:generateContent\?key=/);
    assert.match(url, /key=coverage-gemini-key/);
    const config = body.generationConfig as { responseMimeType?: string; temperature?: number };
    assert.equal(config.responseMimeType, "application/json");
    assert.equal(config.temperature, 0);
    assert.equal(body.tools, undefined);
  } finally {
    globalThis.fetch = orig;
  }
});

test("geminiChat joins candidate parts and prefers the API error over a generic empty", async () => {
  const orig = globalThis.fetch;
  try {
    await withEnv({ GOOGLE_API_KEY: "coverage-gemini-key", GEMINI_API_KEY: undefined }, async () => {
      globalThis.fetch = (async () => envelope([{ text: "Hello" }, { text: "World" }])) as typeof fetch;
      assert.equal(await geminiChat("parts"), "Hello\nWorld");

      globalThis.fetch = (async () =>
        envelope([], { error: { message: "quota exceeded" } })) as typeof fetch;
      await assert.rejects(() => geminiChat("quota"), /quota exceeded/);
    });
  } finally {
    globalThis.fetch = orig;
  }
});
