import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCausation, buildTimeseries, classifyTopic } from "./desk";
import type { CategoryId, Post, Topic } from "./types";

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

function stepMs(series: { t: string }[]): number {
  assert.ok(series.length >= 2, "expected at least two buckets");
  return Date.parse(series[1].t) - Date.parse(series[0].t);
}

test("buildTimeseries uses 15m steps at 4h, hourly just over 4h, and 6h just over 48h", () => {
  const fourHours = buildTimeseries([
    topic([
      post("hn", "start", "2026-08-26T12:00:00.000Z"),
      post("public", "end", "2026-08-26T16:00:00.000Z"),
    ]),
  ]);
  assert.equal(stepMs(fourHours), 15 * 60_000);

  const fourHoursPlus = buildTimeseries([
    topic([
      post("hn", "start", "2026-08-26T12:00:00.000Z"),
      post("public", "end", "2026-08-26T16:00:01.000Z"),
    ]),
  ]);
  assert.equal(stepMs(fourHoursPlus), 3600_000);

  const twoDays = buildTimeseries([
    topic([
      post("hn", "start", "2026-08-26T12:00:00.000Z"),
      post("public", "end", "2026-08-28T12:00:00.000Z"),
    ]),
  ]);
  assert.equal(stepMs(twoDays), 3600_000);

  const twoDaysPlus = buildTimeseries([
    topic([
      post("hn", "start", "2026-08-26T12:00:00.000Z"),
      post("public", "end", "2026-08-28T12:00:01.000Z"),
    ]),
  ]);
  assert.equal(stepMs(twoDaysPlus), 6 * 3600_000);
});

function noticeTopic(title: string): Topic {
  return {
    id: "notice",
    label: "Advisory notice",
    velocity: "rising",
    divergence: 0.2,
    tickers: [],
    platforms: {
      x: emptySlice(),
      reddit: emptySlice(),
      hn: emptySlice(),
      public: {
        score: 10,
        posts: [post("public", title, "2026-08-26T12:00:00.000Z")],
      },
    },
  };
}

test("classifyTopic leftover keyword-only titles still file the desk without a sourceApi", () => {
  const rows: [string, CategoryId][] = [
    ["Congress votes tonight", "news"],
    ["Sanctions package lands", "news"],
    ["Earthquake aftershocks reported", "weather"],
    ["Wildfire smoke advisory", "weather"],
    ["OpenAI model card", "tech"],
    ["ChatGPT outage thread", "tech"],
    ["NFL week-one recap", "sports"],
    ["MLB trade deadline", "sports"],
    ["FDA panel vote", "health"],
    ["Covid booster update", "health"],
    ["CVE-2026-1234 disclosed", "security"],
    ["Exploit kit in the wild", "security"],
    ["Launch event at the lot", "campaigns"],
    ["Test drive weekend", "campaigns"],
    ["Nasdaq open recap", "markets"],
    ["Earnings miss after the bell", "markets"],
    ["Album review tonight", "culture"],
    ["Anime season premiere", "culture"],
  ];
  for (const [title, cat] of rows) {
    assert.equal(classifyTopic(noticeTopic(title)), cat, title);
  }
});

test("buildCausation treats lawsuit language as a risk driver, not a slogan", () => {
  const report = buildCausation(
    topic(
      [
        post("public", "Airline app lawsuit filed", "2026-08-26T12:00:00.000Z"),
        post("hn", "App thread", "2026-08-26T13:00:00.000Z"),
      ],
      { velocity: "peaking", label: "Advisory notice" },
    ),
  );
  assert.ok(report.drivers.some((d) => d.id === "risk" && /lawsuit/.test(d.label)));
});
