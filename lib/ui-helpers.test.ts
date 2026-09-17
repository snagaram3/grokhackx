import assert from "node:assert/strict";
import { test } from "node:test";
import { dominantPlatform, divergenceLabel, sparkValues, topPosts } from "./ui-helpers";
import type { Post, Topic } from "./types";

function emptySlice() {
  return { score: 0, posts: [] as Post[] };
}

function post(title: string, extra: Partial<Post> = {}): Post {
  return {
    platform: extra.platform ?? "x",
    title,
    url: extra.url ?? `https://x.test/${encodeURIComponent(title.slice(0, 24))}`,
    score: extra.score ?? 10,
    createdAt: extra.createdAt ?? "2026-08-26T12:00:00.000Z",
    ...extra,
  };
}

function topic(partial: Partial<Topic> & Pick<Topic, "id" | "label">): Topic {
  return {
    velocity: "rising",
    divergence: 0.5,
    tickers: [],
    platforms: { x: emptySlice(), reddit: emptySlice(), hn: emptySlice(), public: emptySlice() },
    ...partial,
  };
}

test("dominantPlatform is the sole source above 20, otherwise null", () => {
  const xOnly = topic({
    id: "outage",
    label: "Airline app outage",
    platforms: {
      x: { score: 71, posts: [] },
      reddit: emptySlice(),
      hn: emptySlice(),
      public: emptySlice(),
    },
  });
  assert.equal(dominantPlatform(xOnly), "x");

  const tied = topic({
    id: "camry",
    label: "Camry",
    platforms: {
      x: { score: 40, posts: [] },
      reddit: { score: 30, posts: [] },
      hn: emptySlice(),
      public: emptySlice(),
    },
  });
  assert.equal(dominantPlatform(tied), null);

  const quiet = topic({
    id: "thin",
    label: "Thin print",
    platforms: {
      x: { score: 20, posts: [] },
      reddit: emptySlice(),
      hn: emptySlice(),
      public: emptySlice(),
    },
  });
  assert.equal(dominantPlatform(quiet), null);
});

test("divergenceLabel names everywhere, spreading, and X-only vs unlabeled bubbles", () => {
  assert.equal(
    divergenceLabel(topic({ id: "wide", label: "Camry", divergence: 0.34 })),
    "everywhere",
  );
  assert.equal(
    divergenceLabel(topic({ id: "mid", label: "Camry", divergence: 0.5 })),
    "spreading",
  );
  assert.equal(
    divergenceLabel(
      topic({
        id: "x-bubble",
        label: "Outage",
        divergence: 0.75,
        platforms: {
          x: { score: 71, posts: [] },
          reddit: emptySlice(),
          hn: emptySlice(),
          public: emptySlice(),
        },
      }),
    ),
    "X-only bubble",
  );
  assert.equal(
    divergenceLabel(
      topic({
        id: "quiet-bubble",
        label: "Outage",
        divergence: 1,
        platforms: {
          x: { score: 20, posts: [] },
          reddit: emptySlice(),
          hn: emptySlice(),
          public: emptySlice(),
        },
      }),
    ),
    "single-platform bubble",
  );
});

test("topPosts ranks across platforms and sparkValues keeps chronological tail scores", () => {
  const ranked = topic({
    id: "camry",
    label: "Camry",
    platforms: {
      x: { score: 40, posts: [post("weak x", { score: 8, createdAt: "2026-08-26T10:00:00.000Z" })] },
      reddit: {
        score: 30,
        posts: [post("hot reddit", { platform: "reddit", score: 90, createdAt: "2026-08-26T11:00:00.000Z" })],
      },
      hn: {
        score: 20,
        posts: [post("hn thread", { platform: "hn", score: 40, createdAt: "2026-08-26T09:00:00.000Z" })],
      },
      public: emptySlice(),
    },
  });
  assert.deepEqual(
    topPosts(ranked, 2).map((p) => p.title),
    ["hot reddit", "hn thread"],
  );
  assert.deepEqual(sparkValues(ranked), [40, 8, 90]);
});
