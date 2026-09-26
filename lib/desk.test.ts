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

test("classifyTopic leftover keyword-only titles still file the desk without a sourceApi", () => {
  const notice = (title: string) =>
    topic([post("public", title, "2026-08-26T12:00:00.000Z")], { label: "Advisory notice" });
  const rows: [string, CategoryId][] = [
    ["Dealer invoice", "markets"],
    ["MSRP change", "markets"],
    ["EV briefing", "markets"],
    ["F-150 briefing", "markets"],
    ["f150 briefing", "markets"],
    ["Camry briefing", "markets"],
    ["CoinGecko briefing", "markets"],
    ["GitHub advisory", "tech"],
    ["SpaceX briefing", "tech"],
    ["ESPN briefing", "sports"],
    ["Wikipedia page", "culture"],
    ["TVMaze listing", "culture"],
    ["Landing page utm_medium=qr", "campaigns"],
    ["Poster qrco.de link", "campaigns"],
    ["Please scan this qr today", "campaigns"],
    ["Product drop", "campaigns"],
  ];
  for (const [title, category] of rows) {
    assert.equal(classifyTopic(notice(title)), category, title);
  }
});

test("buildCausation leftover controversy is a substring scan, not a word boundary", () => {
  const risk = (title: string, word: string) => {
    const report = buildCausation(
      topic([
        post("public", title, "2026-08-26T12:00:00.000Z"),
        post("hn", "Camry hybrid thread", "2026-08-26T13:00:00.000Z"),
      ]),
    );
    assert.ok(
      report.drivers.some((d) => d.id === "risk" && d.label === `Risk word · ${word}`),
      `${title} → ${word}`,
    );
  };
  risk("App hack disclosed", "hack");
  risk("Data leak reported", "leak");
  risk("Market crash continues", "crash");
  risk("Factory layoff announced", "layoff");
  risk("Border war update", "war");
  risk("Token scam reported", "scam");
  risk("Brand boycott spreads", "boycott");
  risk("Celebrity death reported", "death");
  risk("Pilot killed overnight", "killed");
  risk("Abuse allegations filed", "abuse");
  // Locked: includes() matches inside "warning" / "suburban" — do not word-boundary this.
  risk("Heat warning overnight", "war");
  risk("Suburban lot update", "ban");
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
