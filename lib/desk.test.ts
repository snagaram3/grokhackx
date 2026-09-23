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

function sourced(sourceApi: string, title = "Bulletin"): Topic {
  return topic(
    [
      {
        platform: "public",
        title,
        url: `https://public.test/${encodeURIComponent(sourceApi)}`,
        score: 10,
        createdAt: "2026-08-26T12:00:00.000Z",
        sourceApi,
      },
    ],
    { id: sourceApi.toLowerCase().replace(/\s+/g, "-"), label: "Advisory notice" },
  );
}

test("classifyTopic leftover sourceApis vote the catalog category, not the generic label", () => {
  const routes: [string, CategoryId][] = [
    ["BBC", "news"],
    ["Reuters", "news"],
    ["NYT", "news"],
    ["NPR", "news"],
    ["The Guardian", "news"],
    ["Google News", "news"],
    ["Al Jazeera", "news"],
    ["NHK World", "news"],
    ["ReliefWeb", "news"],
    ["DuckDuckGo", "news"],
    ["YouTube", "culture"],
    ["Bluesky", "culture"],
    ["TVMaze", "culture"],
    ["iTunes", "culture"],
    ["Jikan", "culture"],
    ["Mastodon", "culture"],
    ["Open Library", "culture"],
    ["nager.date", "culture"],
    ["TheSportsDB", "sports"],
    ["CheapShark", "markets"],
    ["CoinCap", "markets"],
    ["CryptoCompare", "markets"],
    ["Fear & Greed", "markets"],
    ["Stack Overflow", "tech"],
    ["TechCrunch", "tech"],
    ["dev.to", "tech"],
    ["Lobsters", "tech"],
    ["OpenAlex", "tech"],
    ["Spaceflight News", "tech"],
    ["GDACS", "weather"],
    ["Carbon Intensity", "weather"],
  ];
  for (const [sourceApi, category] of routes) {
    assert.equal(classifyTopic(sourced(sourceApi)), category, sourceApi);
  }
});

test("classifyTopic keyword votes still route when sourceApi is missing", () => {
  const keywords: [string, CategoryId][] = [
    ["Election treaty filed", "news"],
    ["Hurricane forecast update", "weather"],
    ["Vaccine hospital briefing", "health"],
    ["Ransomware breach advisory", "security"],
    ["Bitcoin ETF filing", "markets"],
    ["NBA playoff preview", "sports"],
  ];
  for (const [title, category] of keywords) {
    assert.equal(
      classifyTopic(topic([post("public", title, "2026-08-26T12:00:00.000Z")], { id: title, label: "Advisory notice" })),
      category,
      title,
    );
  }
});

test("buildTimeseries uses 15-minute steps under 4h and 6-hour steps past 48h", () => {
  const tight = buildTimeseries([
    topic([
      post("hn", "open", "2026-08-26T12:00:00.000Z"),
      post("public", "close", "2026-08-26T12:20:00.000Z"),
    ]),
  ]);
  assert.ok(tight.length >= 2);
  assert.equal(
    new Date(tight[1].t).getTime() - new Date(tight[0].t).getTime(),
    15 * 60_000,
  );

  const wide = buildTimeseries([
    topic([
      post("hn", "open", "2026-08-26T12:00:00.000Z"),
      post("public", "close", "2026-08-30T12:00:00.000Z"),
    ]),
  ]);
  assert.ok(wide.length >= 2);
  assert.equal(
    new Date(wide[1].t).getTime() - new Date(wide[0].t).getTime(),
    6 * 3600_000,
  );
});

test("buildCausation labels rising and peaking velocity without inventing a WHY", () => {
  const rising = buildCausation(
    topic(
      [
        post("hn", "Camry hybrid thread", "2026-08-26T12:00:00.000Z"),
        post("public", "Camry in world news", "2026-08-26T13:00:00.000Z"),
      ],
      { velocity: "rising" },
    ),
  );
  assert.ok(rising.drivers.some((d) => d.id === "velocity" && d.label === "Rising velocity"));

  const peaking = buildCausation(
    topic(
      [
        post("hn", "Camry hybrid thread", "2026-08-26T12:00:00.000Z"),
        post("public", "Camry in world news", "2026-08-26T13:00:00.000Z"),
      ],
      { velocity: "peaking" },
    ),
  );
  assert.ok(peaking.drivers.some((d) => d.id === "velocity" && d.label === "At peak"));
});
