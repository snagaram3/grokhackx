import assert from "node:assert/strict";
import { test } from "node:test";
import { categoryCounts, filterByCategory } from "./desk";
import type { Topic } from "./types";

function emptySlice() {
  return { score: 0, posts: [] as Topic["platforms"]["public"]["posts"] };
}

function topic(partial: Partial<Topic> & Pick<Topic, "id" | "label">): Topic {
  return {
    velocity: "rising",
    divergence: 0,
    tickers: [],
    platforms: {
      x: emptySlice(),
      reddit: emptySlice(),
      hn: emptySlice(),
      public: emptySlice(),
    },
    ...partial,
  };
}

test("filterByCategory all is identity; other plugs keep only matching prints", () => {
  const markets = topic({
    id: "tsla",
    label: "TSLA",
    tickers: [{ symbol: "TSLA", sentiment: "pos", mentions: 3 }],
  });
  const news = topic({
    id: "storm",
    label: "Storm",
    platforms: {
      x: emptySlice(),
      reddit: emptySlice(),
      hn: emptySlice(),
      public: {
        score: 12,
        posts: [
          {
            platform: "public",
            title: "Storm warning",
            url: "https://news.test/storm",
            score: 12,
            createdAt: "2026-08-29T00:00:00.000Z",
            sourceApi: "GDELT",
          },
        ],
      },
    },
  });
  const culture = topic({ id: "meme", label: "Meme" });
  const tape = [markets, news, culture];

  assert.equal(filterByCategory(tape, "all"), tape);
  assert.deepEqual(
    filterByCategory(tape, "markets").map((t) => t.id),
    ["tsla"],
  );
  assert.deepEqual(
    filterByCategory(tape, "news").map((t) => t.id),
    ["storm"],
  );
  assert.deepEqual(
    filterByCategory(tape, "culture").map((t) => t.id),
    ["meme"],
  );
});

test("categoryCounts all equals tape length and category buckets sum to all", () => {
  const tape = [
    topic({
      id: "tsla",
      label: "TSLA",
      tickers: [{ symbol: "TSLA", sentiment: "mixed", mentions: 1 }],
    }),
    topic({
      id: "hn",
      label: "New runtime",
      platforms: {
        x: emptySlice(),
        reddit: emptySlice(),
        hn: { score: 40, posts: [] },
        public: emptySlice(),
      },
    }),
    topic({ id: "idle", label: "Idle print" }),
  ];
  const counts = categoryCounts(tape);
  assert.equal(counts.all, 3);
  const plugged = Object.entries(counts)
    .filter(([key]) => key !== "all")
    .reduce((n, [, v]) => n + v, 0);
  assert.equal(plugged, counts.all);
  assert.equal(counts.markets, 1);
  assert.equal(counts.tech, 1);
  assert.equal(counts.culture, 1);
});
