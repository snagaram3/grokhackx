import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEventTicks, eventKindOf } from "./event-ticks";
import type { Post, Topic } from "./types";

function emptySlice() {
  return { score: 0, posts: [] as Topic["platforms"]["public"]["posts"] };
}

function topicFrom(posts: Post[]): Topic {
  const platforms = {
    x: emptySlice(),
    reddit: emptySlice(),
    hn: emptySlice(),
    public: emptySlice(),
  };
  for (const p of posts) {
    platforms[p.platform].posts.push(p);
    platforms[p.platform].score += p.score;
  }
  return {
    id: "camry",
    label: "Camry",
    velocity: "rising",
    divergence: 0.2,
    tickers: [],
    platforms,
  };
}

function post(
  platform: Post["platform"],
  title: string,
  createdAt: string,
  extra: Partial<Post> = {},
): Post {
  return {
    platform,
    title,
    url: extra.url ?? `https://${platform}.test/${encodeURIComponent(title)}`,
    score: extra.score ?? 10,
    createdAt,
    sourceApi: extra.sourceApi,
  };
}

test("eventKindOf maps weather.gov and NOAA aliases and ignores empty names", () => {
  assert.equal(eventKindOf("weather.gov"), "nws");
  assert.equal(eventKindOf("NOAA alert"), "nws");
  assert.equal(eventKindOf("nws"), "nws");
  assert.equal(eventKindOf(""), null);
  assert.equal(eventKindOf(undefined), null);
  assert.equal(eventKindOf("Wikipedia"), null);
});

test("buildEventTicks skips public-only origin, dup URLs, bad dates, and honors the cap", () => {
  const onlyEvents = topicFrom([
    post("public", "Camry in world news", "2026-08-26T15:00:00.000Z", {
      sourceApi: "GDELT",
      url: "https://gdelt.test/camry",
    }),
    post("public", "same article copy", "2026-08-26T16:00:00.000Z", {
      sourceApi: "GDELT",
      url: "https://gdelt.test/camry",
    }),
    post("public", "broken stamp", "not-a-date", { sourceApi: "NWS" }),
  ]);
  const ticks = buildEventTicks([onlyEvents]);
  assert.equal(ticks.length, 1);
  assert.equal(ticks[0].lagHours, null);
  assert.equal(ticks[0].inWindow, false);
  assert.equal(ticks[0].kind, "gdelt");

  const many = topicFrom(
    Array.from({ length: 12 }, (_, i) =>
      post("public", `event ${i}`, `2026-08-26T${String(10 + (i % 10)).padStart(2, "0")}:00:00.000Z`, {
        sourceApi: "GDELT",
        url: `https://gdelt.test/${i}`,
      }),
    ),
  );
  assert.equal(buildEventTicks([many], 8).length, 8);
});
