import assert from "node:assert/strict";
import { test } from "node:test";
import { collectorSummary, healthFrom, reviewerAgent, validatorAgent, whyAgent } from "./agents";
import type { Post, Topic } from "./types";

function emptySlice() {
  return { score: 0, posts: [] as Post[] };
}

function topic(label: string, posts: Post[], score = 40): Topic {
  const platforms = {
    x: emptySlice(),
    reddit: emptySlice(),
    hn: emptySlice(),
    public: emptySlice(),
  };
  for (const p of posts) {
    platforms[p.platform].posts.push(p);
    platforms[p.platform].score = score;
  }
  return {
    id: label.toLowerCase().replace(/\s+/g, "-"),
    label,
    velocity: "rising",
    divergence: 0.5,
    tickers: [],
    platforms,
  };
}

function post(title: string, url: string, platform: Post["platform"] = "public"): Post {
  return {
    platform,
    title,
    url,
    score: 10,
    createdAt: "2026-08-26T12:00:00.000Z",
  };
}

test("validatorAgent drops invalid URLs, empty topics, and duplicate labels", () => {
  const camry = topic("Camry", [
    post("Camry hybrid", "https://en.wikipedia.org/wiki/Camry"),
    post("broken", "not-a-url"),
    post("ftp", "ftp://files.test/camry"),
  ]);
  const empty = topic("Ghost", [post("no href", "")]);
  const dup = topic("camry", [post("Camry sales", "https://news.test/camry")]);
  const tesla = topic("Tesla", [post("Tesla thread", "https://hn.test/tesla")], 150);

  const result = validatorAgent([camry, empty, dup, tesla]);
  assert.equal(result.droppedPosts, 3);
  assert.equal(result.droppedTopics, 2);
  assert.deepEqual(
    result.topics.map((t) => t.label),
    ["Camry", "Tesla"],
  );
  assert.equal(result.topics[0].platforms.public.posts.length, 1);
  assert.equal(result.topics[0].platforms.public.posts[0].url, "https://en.wikipedia.org/wiki/Camry");
  assert.equal(result.topics[1].platforms.public.score, 100);
  assert.match(result.log, /validator: -2 topics, -3 posts/);
});

test("healthFrom marks offline sources without inventing a WHY", () => {
  const { sources, degraded } = healthFrom([
    { source: "x", ok: false, count: 0, posts: [] },
    { source: "reddit", ok: true, count: 4, posts: [] },
    { source: "hn", ok: true, count: 2, posts: [] },
    { source: "public", ok: false, count: 0, posts: [] },
  ]);
  assert.deepEqual(sources, { x: false, reddit: true, hn: true, public: false });
  assert.deepEqual(degraded, ["x offline", "public offline"]);
  assert.equal(
    collectorSummary([
      { source: "x", ok: false, count: 0, posts: [] },
      { source: "hn", ok: true, count: 2, posts: [] },
    ]),
    "collector: x fail(0) hn ok(2)",
  );
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

async function withoutGeminiKey(fn: () => Promise<void>) {
  const prevG = process.env.GOOGLE_API_KEY;
  const prevM = process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    await fn();
  } finally {
    if (prevG === undefined) delete process.env.GOOGLE_API_KEY;
    else process.env.GOOGLE_API_KEY = prevG;
    if (prevM === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevM;
  }
}

test("reviewerAgent and whyAgent skip when the Google key or tape is missing", async () => {
  const camry = topic("Camry", [post("Camry hybrid", "https://en.wikipedia.org/wiki/Camry")]);
  await withoutGeminiKey(async () => {
    const review = await reviewerAgent([camry]);
    assert.equal(review.log, "reviewer: skipped");
    assert.equal(review.topics.length, 1);
    assert.equal(review.topics[0], camry);
    const why = await whyAgent([camry]);
    assert.equal(why.log, "why: skipped");
    assert.equal(why.topics[0].why, undefined);
  });

  await withGeminiKey('{"remove":[{"id":"camry"}]}', async () => {
    const empty = await reviewerAgent([]);
    assert.equal(empty.log, "reviewer: skipped");
    assert.deepEqual(empty.topics, []);
    const why = await whyAgent([]);
    assert.equal(why.log, "why: skipped");
  });
});

test("reviewerAgent drops flagged ids, keeps the tape if every row is flagged, and extracts wrapped JSON", async () => {
  const camry = topic("Camry", [post("Camry hybrid", "https://en.wikipedia.org/wiki/Camry")]);
  const tesla = topic("Tesla", [post("Tesla thread", "https://hn.test/tesla")]);
  const spam = topic("Spam", [post("buy followers", "https://spam.test/1")]);

  await withGeminiKey('{"remove":[{"id":"spam","reason":"not a real trend"}]}', async () => {
    const reviewed = await reviewerAgent([camry, tesla, spam]);
    assert.deepEqual(
      reviewed.topics.map((t) => t.id),
      ["camry", "tesla"],
    );
    assert.match(reviewed.log, /reviewer: -1/);
  });

  await withGeminiKey(
    '{"remove":[{"id":"camry","reason":"dup"},{"id":"tesla","reason":"dup"}]}',
    async () => {
      const kept = await reviewerAgent([camry, tesla]);
      assert.equal(kept.topics.length, 2);
      assert.equal(kept.topics[0], camry);
      assert.equal(kept.topics[1], tesla);
      assert.match(kept.log, /reviewer: -2/);
    },
  );

  await withGeminiKey('Sure, here is the JSON:\n{"remove":[]}\nThanks.', async () => {
    const none = await reviewerAgent([camry]);
    assert.equal(none.log, "reviewer: -0");
    assert.equal(none.topics.length, 1);
  });

  await withGeminiKey("not-json", async () => {
    const skipped = await reviewerAgent([camry]);
    assert.equal(skipped.log, "reviewer: skipped");
    assert.equal(skipped.topics[0], camry);
  });
});

test("whyAgent stamps matching ids, clamps copy, and ignores unknown slugs", async () => {
  const camry = topic("Camry", [post("Camry hybrid", "https://en.wikipedia.org/wiki/Camry")]);
  const tesla = topic("Tesla", [post("Tesla thread", "https://hn.test/tesla")]);
  const longWhy = "Live NHTSA recall thread. ".repeat(20);

  await withGeminiKey(
    JSON.stringify({
      why: [
        { id: "camry", why: longWhy },
        { id: "ghost", why: "not on the tape" },
      ],
    }),
    async () => {
      const stamped = await whyAgent([camry, tesla]);
      assert.equal(stamped.log, "why: 1");
      assert.equal(camry.why?.length, 240);
      assert.match(camry.why ?? "", /NHTSA recall/);
      assert.equal(tesla.why, undefined);
    },
  );
});
