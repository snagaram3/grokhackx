import assert from "node:assert/strict";
import { test } from "node:test";
import { clusterTopics } from "./cluster";
import type { Post, RawSignals } from "./types";

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

function post(title: string, platform: Post["platform"], score = 40): Post {
  return {
    platform,
    title,
    url: `https://${platform}.test/${encodeURIComponent(title)}`,
    score,
    createdAt: "2026-08-26T12:00:00.000Z",
  };
}

function signals(extra: Partial<RawSignals> = {}): RawSignals {
  return {
    reddit: [],
    hn: [],
    x: [],
    public: [],
    sources: { x: false, reddit: false, hn: false, public: false },
    degraded: [],
    ...extra,
  };
}

function envelope(text: string): Response {
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
    text: async () => "",
  } as Response;
}

test("clusterTopics copies live posts by URL from a Gemini group and ignores invented hrefs", async () => {
  const camry = post("Camry recall", "x", 80);
  const orig = globalThis.fetch;
  globalThis.fetch = (async () =>
    envelope(
      JSON.stringify({
        topics: [
          {
            id: "camry",
            label: "Camry",
            platforms: {
              x: {
                score: 80,
                posts: [
                  camry,
                  {
                    platform: "x",
                    title: "Invented Camry post",
                    url: "https://x.test/invented",
                    score: 99,
                    createdAt: "2026-08-26T12:00:00.000Z",
                  },
                ],
              },
              reddit: { score: 0, posts: [] },
              hn: { score: 0, posts: [] },
            },
          },
        ],
      }),
    )) as typeof fetch;
  try {
    await withEnv("GOOGLE_API_KEY", "coverage-cluster-key", async () => {
      await withEnv("GEMINI_API_KEY", undefined, async () => {
        const topics = await clusterTopics(signals({ x: [camry] }));
        assert.equal(topics.length, 1);
        assert.equal(topics[0].label, "Camry");
        assert.deepEqual(
          topics[0].platforms.x.posts.map((p) => p.url),
          [camry.url],
        );
        assert.equal(
          topics[0].platforms.x.posts.some((p) => p.url.includes("invented")),
          false,
        );
      });
    });
  } finally {
    globalThis.fetch = orig;
  }
});

test("clusterTopics falls back to score-ranked singletons when Gemini grouping is not JSON", async () => {
  const high = post("Camry hybrid", "hn", 90);
  const low = post("Civic sales", "hn", 12);
  const orig = globalThis.fetch;
  globalThis.fetch = (async () => envelope("not-json")) as typeof fetch;
  try {
    await withEnv("GOOGLE_API_KEY", "coverage-cluster-fallback-key", async () => {
      await withEnv("GEMINI_API_KEY", undefined, async () => {
        const topics = await clusterTopics(signals({ hn: [low, high] }));
        assert.equal(topics.length, 2);
        assert.equal(topics[0].label, "Camry hybrid");
        assert.equal(topics[0].platforms.hn.posts[0].url, high.url);
        assert.equal(topics[1].label, "Civic sales");
      });
    });
  } finally {
    globalThis.fetch = orig;
  }
});
