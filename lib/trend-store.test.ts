import assert from "node:assert/strict";
import { test } from "node:test";
import { wordFromTopic } from "./trend-store";
import type { Topic } from "./types";

function emptySlice() {
  return { score: 0, posts: [] as Topic["platforms"]["x"]["posts"] };
}

test("wordFromTopic keeps AutoLineage tool and collectedAt on receipts", () => {
  const topic: Topic = {
    id: "camry",
    label: "Camry",
    velocity: "rising",
    divergence: 0.2,
    tickers: [],
    platforms: {
      x: emptySlice(),
      reddit: emptySlice(),
      hn: emptySlice(),
      public: {
        score: 40,
        posts: [
          {
            platform: "public",
            title: "Camry search heat",
            url: "https://trends.google.com/trending/explore?q=Camry&geo=US",
            score: 40,
            createdAt: "2026-08-31T12:00:00.000Z",
            sourceApi: "google-trends",
            tool: "collect_google_trends",
            collectedAt: "2026-08-31T12:00:01.000Z",
          },
        ],
      },
    },
  };
  const point = wordFromTopic(topic, undefined, "2026-08-31T12:00:02.000Z");
  assert.equal(point.receiptCount, 1);
  assert.equal(point.receipts?.[0].tool, "collect_google_trends");
  assert.equal(point.receipts?.[0].collectedAt, "2026-08-31T12:00:01.000Z");
  assert.equal(point.receipts?.[0].sourceApi, "google-trends");
});
