import assert from "node:assert/strict";
import { test } from "node:test";
import { enrichQueryIntent, inferQueryIntent, toQueryInsight } from "./query";
import type { SentimentReport, Topic } from "./types";

function emptySlice() {
  return { score: 0, posts: [] as Topic["platforms"]["public"]["posts"] };
}

function topic(
  label: string,
  posts: { title: string; url: string }[],
  match?: Topic["match"],
): Topic {
  const publicPosts = posts.map((p) => ({
    platform: "public" as const,
    title: p.title,
    url: p.url,
    score: 10,
    createdAt: "2026-08-29T00:00:00.000Z",
  }));
  return {
    id: label.toLowerCase(),
    label,
    velocity: "rising",
    divergence: 0.2,
    tickers: [],
    match,
    platforms: {
      x: emptySlice(),
      reddit: emptySlice(),
      hn: emptySlice(),
      public: { score: publicPosts.length * 10, posts: publicPosts },
    },
  };
}

function sentiment(partial: Partial<SentimentReport> = {}): SentimentReport {
  return {
    topicId: "camry",
    lean: "pos",
    overall: { pos: 4, neg: 1, risk: 0, n: 5 },
    byPlatform: {},
    drivers: [],
    quotes: [],
    hits: [],
    thin: false,
    ...partial,
  };
}

test("toQueryInsight with no topics is a neighbor miss, not an invented exact hit", () => {
  const intent = inferQueryIntent("Camry");
  const insight = toQueryInsight(intent, [], null);
  assert.equal(insight.match, "neighbor");
  assert.equal(insight.hitCount, 0);
  assert.equal(insight.kind, "product");
  assert.match(insight.floor, /No exact print/);
});

test("toQueryInsight counts receipts and keeps the topic match", () => {
  const intent = inferQueryIntent("Camry");
  const exact = toQueryInsight(
    intent,
    [
      topic(
        "Camry",
        [
          { title: "Toyota Camry recall", url: "https://nhtsa.test/1" },
          { title: "Camry hybrid", url: "https://news.test/2" },
        ],
        "exact",
      ),
    ],
    sentiment(),
  );
  assert.equal(exact.match, "exact");
  assert.equal(exact.hitCount, 2);
  assert.match(exact.floor, /positive/);

  const near = toQueryInsight(intent, [topic("Camry", [{ title: "Camry", url: "https://a.test/1" }], "near")], null);
  assert.equal(near.match, "near");
  assert.match(near.floor, /Not an exact match/);

  const thin = toQueryInsight(
    intent,
    [topic("Camry", [{ title: "Camry", url: "https://a.test/1" }], "exact")],
    sentiment({ thin: true, lean: "thin" }),
  );
  assert.match(thin.floor, /thin/);
});

function geminiHttp(text: string): Response {
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  } as Response;
}

async function withGeminiKey(body: string, fn: () => Promise<void>) {
  const prevG = process.env.GOOGLE_API_KEY;
  const prevM = process.env.GEMINI_API_KEY;
  const orig = globalThis.fetch;
  process.env.GOOGLE_API_KEY = "test-key";
  delete process.env.GEMINI_API_KEY;
  globalThis.fetch = (async () => geminiHttp(body)) as typeof fetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = orig;
    if (prevG === undefined) delete process.env.GOOGLE_API_KEY;
    else process.env.GOOGLE_API_KEY = prevG;
    if (prevM === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevM;
  }
}

test("enrichQueryIntent skips without a key and when the local intent already has aliases", async () => {
  const prevG = process.env.GOOGLE_API_KEY;
  const prevM = process.env.GEMINI_API_KEY;
  const orig = globalThis.fetch;
  let calls = 0;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.GEMINI_API_KEY;
  globalThis.fetch = (async () => {
    calls += 1;
    return geminiHttp("{}");
  }) as typeof fetch;
  try {
    const generic = inferQueryIntent("blorptastic");
    const skipped = await enrichQueryIntent(generic);
    assert.equal(skipped, generic);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = orig;
    if (prevG === undefined) delete process.env.GOOGLE_API_KEY;
    else process.env.GOOGLE_API_KEY = prevG;
    if (prevM === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevM;
  }

  await withGeminiKey(
    JSON.stringify({ kind: "hashtag", category: "campaigns", aliases: ["should-not-apply"] }),
    async () => {
      const tesla = inferQueryIntent("Tesla");
      assert.ok(tesla.aliases.length >= 2);
      const kept = await enrichQueryIntent(tesla);
      assert.equal(kept.kind, "product");
      assert.equal(kept.category, "markets");
      assert.equal(kept.aliases.includes("should-not-apply"), false);
    },
  );
});

test("enrichQueryIntent upgrades generic queries, keeps known kinds, and drops junk aliases", async () => {
  await withGeminiKey(
    JSON.stringify({ kind: "product", category: "markets", aliases: ["gadget"] }),
    async () => {
      const upgraded = await enrichQueryIntent(inferQueryIntent("blorptastic"));
      assert.equal(upgraded.kind, "product");
      assert.equal(upgraded.category, "markets");
      assert.ok(upgraded.aliases.includes("gadget"));
    },
  );

  await withGeminiKey(
    JSON.stringify({
      kind: "hashtag",
      category: "campaigns",
      aliases: ["Toyota"],
    }),
    async () => {
      const camry = await enrichQueryIntent(inferQueryIntent("Camry"));
      assert.equal(camry.kind, "product");
      assert.equal(camry.category, "markets");
      assert.ok(camry.aliases.some((a) => a.toLowerCase().includes("toyota")));
    },
  );

  await withGeminiKey(
    JSON.stringify({
      kind: "spaceship",
      category: "moon",
      aliases: ["x", "Hello!", "this-alias-is-way-too-long-for-the-forty-char-cap-xx", "ok"],
    }),
    async () => {
      const generic = await enrichQueryIntent(inferQueryIntent("blorptastic"));
      assert.equal(generic.kind, "generic");
      assert.equal(generic.category, "culture");
      assert.deepEqual(generic.aliases, ["ok"]);
    },
  );
});
