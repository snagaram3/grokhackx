import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCausation, buildTimeseries, classifyTopic } from "./desk";
import type { Post, Topic } from "./types";

function emptySlice() {
  return { score: 0, posts: [] as Post[] };
}

function topic(posts: Post[], extra: Partial<Topic> = {}): Topic {
  const byPlat = { x: emptySlice(), reddit: emptySlice(), hn: emptySlice(), public: emptySlice() };
  for (const p of posts) {
    byPlat[p.platform].posts.push(p);
    byPlat[p.platform].score += p.score;
  }
  return {
    id: "camry",
    label: "Camry",
    velocity: "rising",
    divergence: 0.7,
    tickers: [],
    platforms: byPlat,
    ...extra,
  };
}

function post(platform: Post["platform"], title: string, createdAt: string, score = 10): Post {
  return {
    platform,
    title,
    url: `https://${platform}.test/${encodeURIComponent(title)}`,
    score,
    createdAt,
  };
}

test("buildCausation is thin under two receipts and measures first print plus lag", () => {
  const none = buildCausation(topic([]));
  assert.equal(none.thin, true);
  assert.equal(none.firstPlatform, null);
  assert.equal(none.lagHours, null);

  const one = buildCausation(topic([post("hn", "Camry hybrid thread", "2026-08-26T12:00:00.000Z")]));
  assert.equal(one.thin, true);
  assert.equal(one.firstPlatform, "hn");
  assert.equal(one.lagHours, null);

  const lagged = buildCausation(
    topic([
      post("hn", "Camry hybrid thread", "2026-08-26T12:00:00.000Z", 12),
      post("public", "Camry in world news", "2026-08-26T15:00:00.000Z", 70),
      post("public", "broken stamp", "not-a-date", 5),
    ]),
  );
  assert.equal(lagged.thin, false);
  assert.equal(lagged.firstPlatform, "hn");
  assert.equal(lagged.firstAt, "2026-08-26T12:00:00.000Z");
  assert.equal(lagged.lagHours, 3);
  assert.equal(lagged.peakAt, "2026-08-26T15:00:00.000Z");
  assert.ok(lagged.drivers.some((d) => d.id === "first-print"));
  assert.ok(lagged.drivers.some((d) => d.id === "lag" && /Second source \+3h/.test(d.label)));
});

test("buildCausation treats recall language as a risk driver, not a slogan", () => {
  const report = buildCausation(
    topic(
      [
        post("public", "Camry recall announced", "2026-08-26T12:00:00.000Z"),
        post("hn", "Camry hybrid thread", "2026-08-26T13:00:00.000Z"),
      ],
      { velocity: "fading" },
    ),
    [{ kind: "hashtag", value: "#Camry", mentions: 2, platforms: ["public"] }],
  );
  assert.ok(report.drivers.some((d) => d.id === "risk" && /recall/.test(d.label)));
  assert.ok(report.drivers.some((d) => d.id === "hashtags"));
  assert.ok(report.drivers.some((d) => d.id === "velocity" && d.label === "Cooling"));
});

test("classifyTopic leftover market keywords file Markets without a sourceApi", () => {
  const keyword = (title: string): Topic =>
    topic([post("public", title, "2026-08-26T12:00:00.000Z")], { label: "Advisory notice" });
  assert.equal(classifyTopic(keyword("Advisory notice toyota")), "markets");
  assert.equal(classifyTopic(keyword("Advisory notice honda")), "markets");
  assert.equal(classifyTopic(keyword("Advisory notice ford")), "markets");
  assert.equal(classifyTopic(keyword("Advisory notice civic")), "markets");
  assert.equal(classifyTopic(keyword("Advisory notice tesla")), "markets");
  assert.equal(classifyTopic(keyword("Advisory notice mustang")), "markets");
});

test("buildCausation leftover first-print weight is heavier on a high-divergence bubble", () => {
  const posts = [
    post("hn", "Camry hybrid thread", "2026-08-26T12:00:00.000Z", 12),
    post("public", "Camry in world news", "2026-08-26T15:00:00.000Z", 12),
  ];
  const bubble = buildCausation(topic(posts, { divergence: 0.7 }));
  const spread = buildCausation(topic(posts, { divergence: 0.2 }));
  const bubbleFirst = bubble.drivers.find((d) => d.id === "first-print");
  const spreadFirst = spread.drivers.find((d) => d.id === "first-print");
  assert.ok(bubbleFirst && spreadFirst);
  assert.ok(bubbleFirst.weight > spreadFirst.weight);
});

test("buildTimeseries ignores invalid dates and buckets dated receipts", () => {
  assert.deepEqual(buildTimeseries([topic([])]), []);
  const series = buildTimeseries([
    topic([
      post("hn", "early", "2026-08-26T12:00:00.000Z"),
      post("public", "later", "2026-08-26T13:00:00.000Z"),
      post("reddit", "bad", "nope"),
    ]),
  ]);
  assert.ok(series.length >= 2);
  const totals = series.reduce((n, b) => n + b.total, 0);
  assert.equal(totals, 2);
  assert.equal(
    series.reduce((n, b) => n + b.hn, 0),
    1,
  );
  assert.equal(
    series.reduce((n, b) => n + b.public, 0),
    1,
  );
});
