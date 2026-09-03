import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hostOf,
  isOfficial,
  nextWindowFromSeries,
  normalizeAliases,
  occupancyExamples,
  receiptHitsAlias,
  scorePoi,
  type PoiReceipt,
} from "./poi";
import { fitHistGb, occupancyVector } from "./histgb";
import { deltaLabel, pct, rollupWatchlist, sortInsights } from "./watchlist-metrics";
import { payloadFromQrImageUrl } from "./qr";
import { insightForQuery, leadTopic, postsInBucket, relatedPrints, topicPosts, topicsInBucket } from "./watchlist-lookup";
import type { PoiInsight, TimeBucket, Topic, WatchlistEntity } from "./types";

function entity(label: string, extra: string[] = []): WatchlistEntity {
  return {
    id: label.toLowerCase(),
    label,
    aliases: normalizeAliases(label, extra),
    owner: "demo",
    createdAt: "2026-08-21T00:00:00.000Z",
  };
}

function receipt(partial: Partial<PoiReceipt> & Pick<PoiReceipt, "url" | "title">): PoiReceipt {
  return {
    snapshotId: "s1",
    platform: "public",
    score: 50,
    createdAt: "2026-08-21T00:00:00.000Z",
    ...partial,
  };
}

test("normalizeAliases keeps label and extra, drops dupes", () => {
  const aliases = normalizeAliases("Camry", ["Toyota Camry", "camry", "TM"]);
  assert.deepEqual(aliases, ["Camry", "Toyota Camry", "TM"]);
});

test("receiptHitsAlias uses word boundaries", () => {
  assert.equal(receiptHitsAlias({ title: "New Camry hybrid", url: "https://x.test/a" }, ["Camry"]), true);
  assert.equal(receiptHitsAlias({ title: "camera sensor", url: "https://x.test/a" }, ["Camry"]), false);
  assert.equal(receiptHitsAlias({ title: "heat", url: "https://x.test/#HeatWaveFit" }, ["#HeatWaveFit"]), true);
});

test("isOfficial marks wiki, nhtsa, and brand-like hosts", () => {
  assert.equal(isOfficial("https://en.wikipedia.org/wiki/Camry", "Camry"), true);
  assert.equal(isOfficial("https://www.nhtsa.gov/recalls", "Camry"), true);
  assert.equal(isOfficial("https://www.reuters.com/camry", "Camry"), false);
});

test("scorePoi is thin under 4 receipts and abstains", () => {
  const camry = entity("Camry");
  const scored = scorePoi(camry, [
    receipt({ url: "https://en.wikipedia.org/wiki/Camry", title: "Camry" }),
    receipt({ url: "https://news.test/camry", title: "Camry sales" }),
  ]);
  assert.equal(scored.thin, true);
  assert.equal(scored.receiptCount, 2);
  assert.equal(scored.outlook, "thin");
});

test("scorePoi splits official vs occupied and builds a window", () => {
  const camry = entity("Camry", ["Toyota Camry"]);
  const receipts: PoiReceipt[] = [
    receipt({ snapshotId: "a", url: "https://en.wikipedia.org/wiki/Toyota_Camry", title: "Toyota Camry" }),
    receipt({ snapshotId: "a", url: "https://www.nhtsa.gov/camry", title: "Camry recall" }),
    receipt({ snapshotId: "b", url: "https://www.reuters.com/world/camry-surge", title: "Camry surge" }),
    receipt({ snapshotId: "b", url: "https://hn.test/item/1", title: "Camry hybrid thread" }),
    receipt({ snapshotId: "b", url: "https://cars.test/camry", title: "Camry vs Accord" }),
  ];
  const scored = scorePoi(camry, receipts);
  assert.equal(scored.thin, false);
  assert.equal(scored.officialCount, 2);
  assert.equal(scored.occupiedCount, 3);
  assert.equal(scored.occupancy, 0.6);
  assert.equal(scored.organic, 0.4);
  assert.deepEqual(scored.window, [2, 3]);
  assert.equal(scored.delta, 1);
  assert.equal(scored.outlook, "rising");
  assert.ok(scored.occupiers.some((o) => o.host === "reuters.com"));
});

test("nextWindowFromSeries abstains, rises, and uses baseline to peak", () => {
  assert.equal(nextWindowFromSeries([4], 0.1, 0.1), "thin");
  assert.equal(nextWindowFromSeries([10, 20], 0.1, 0.1), "rising");
  assert.equal(nextWindowFromSeries([20, 10], 0.2, 0.1), "peaking");
});

test("rollupWatchlist and sortInsights follow occupancy vs organic", () => {
  const camry = scorePoi(entity("Camry"), [
    receipt({ url: "https://en.wikipedia.org/wiki/Camry", title: "Camry" }),
    receipt({ url: "https://www.nhtsa.gov/camry", title: "Camry" }),
    receipt({ url: "https://news.test/camry", title: "Camry" }),
    receipt({ url: "https://press.test/camry", title: "Camry" }),
  ]);
  const tesla = scorePoi(entity("Tesla"), [
    receipt({ url: "https://en.wikipedia.org/wiki/Tesla,_Inc.", title: "Tesla" }),
    receipt({ url: "https://tesla.com/news", title: "Tesla" }),
    receipt({ url: "https://arxiv.org/abs/tesla", title: "Tesla" }),
    receipt({ url: "https://uspto.gov/tesla", title: "Tesla" }),
    receipt({ url: "https://news.test/tesla", title: "Tesla" }),
  ]);
  const rollup = rollupWatchlist([camry, tesla]);
  assert.equal(rollup.watched, 2);
  assert.equal(rollup.receipts, 9);
  assert.equal(rollup.thin, 0);
  assert.ok((rollup.occupancyMean ?? 0) > 0);
  const byOcc = sortInsights([camry, tesla], "occupancy", "desc");
  assert.equal(byOcc[0].entity.label, "Camry");
  const byOrg = sortInsights([camry, tesla], "organic", "desc");
  assert.equal(byOrg[0].entity.label, "Tesla");
});

test("pct and deltaLabel stay operator-readable", () => {
  assert.equal(pct(0.62), "62%");
  assert.equal(deltaLabel(12), "+12");
  assert.equal(deltaLabel(-3), "-3");
});

test("unrelated names do not steal Camry receipts", () => {
  const tesla = entity("Tesla");
  const scored = scorePoi(tesla, [
    receipt({ url: "https://en.wikipedia.org/wiki/Camry", title: "Toyota Camry" }),
  ]);
  assert.equal(scored.receiptCount, 0);
});

function fakeInsight(label: string, occupancy: number, organic: number): PoiInsight {
  return {
    entity: entity(label),
    receiptCount: 10,
    officialCount: Math.round(organic * 10),
    occupiedCount: Math.round(occupancy * 10),
    organic,
    occupancy,
    outlook: "rising",
    confidence: 0.5,
    thin: false,
    analysis: "test",
    occupiers: [],
    snapshotCount: 2,
    delta: 1,
    baselineRatio: 0.1,
    rankScore: occupancy,
    window: [4, 6],
  };
}

test("sortInsights rank keeps higher rankScore first", () => {
  const rows = sortInsights(
    [fakeInsight("Low", 0.2, 0.8), fakeInsight("High", 0.9, 0.1)],
    "rank",
    "desc",
  );
  assert.equal(rows[0].entity.label, "High");
});

test("watchlist store add, join tape, remove", async () => {
  const { addWatchlist, insightsFor, listWatchlist, removeWatchlist } = await import("./watchlist-store");
  const label = "WatchlistTestPhraseZz";
  const added = await addWatchlist(label, normalizeAliases(label));
  try {
    const listed = await listWatchlist();
    assert.ok(listed.entities.some((row) => row.id === added.id));
    const [hit] = await insightsFor([added], {
      updatedAt: "2026-08-21T00:00:00.000Z",
      degraded: [],
      sources: { x: false, reddit: false, hn: false, public: true },
      topics: [
        {
          id: "t1",
          label,
          velocity: "rising",
          divergence: 0,
          tickers: [],
          platforms: {
            x: { score: 0, posts: [] },
            reddit: { score: 0, posts: [] },
            hn: { score: 0, posts: [] },
            public: {
              score: 10,
              posts: [
                {
                  id: "p1",
                  platform: "public",
                  title: `${label} on Wikipedia`,
                  url: `https://en.wikipedia.org/wiki/${label}`,
                  score: 10,
                  createdAt: "2026-08-21T00:00:00.000Z",
                },
              ],
            },
          },
        },
      ],
    } );
    assert.ok(hit.receiptCount >= 1);
    assert.ok(Array.isArray(hit.window));
  } finally {
    await removeWatchlist(added.id);
  }
});

function topic(label: string, posts: { title: string; url: string; createdAt: string; platform?: Topic["platforms"]["public"]["posts"][0]["platform"] }[]): Topic {
  const empty = { score: 0, posts: [] as Topic["platforms"]["public"]["posts"] };
  const publicPosts = posts.map((p) => ({
    platform: p.platform ?? "public",
    title: p.title,
    url: p.url,
    score: 10,
    createdAt: p.createdAt,
  }));
  return {
    id: label.toLowerCase(),
    label,
    velocity: "rising",
    divergence: 0.25,
    tickers: [],
    platforms: {
      x: empty,
      reddit: empty,
      hn: empty,
      public: { score: publicPosts.length * 10, posts: publicPosts },
    },
  };
}

test("leadTopic and relatedPrints follow payload order", () => {
  const camry = topic("Camry", []);
  const tesla = topic("Tesla", []);
  const payload = {
    topics: [camry, tesla],
    updatedAt: "2026-08-26T00:00:00.000Z",
    sources: { x: false, reddit: false, hn: false, public: true },
    degraded: [],
  };
  assert.equal(leadTopic(payload)?.label, "Camry");
  assert.deepEqual(relatedPrints(payload).map((t) => t.label), ["Tesla"]);
  assert.equal(leadTopic(null), null);
});

test("postsInBucket filters dated receipts to the selected window", () => {
  const posts = topicPosts(
    topic("Camry", [
      { title: "early", url: "https://a.test/1", createdAt: "2026-08-26T14:10:00.000Z" },
      { title: "later", url: "https://a.test/2", createdAt: "2026-08-26T16:10:00.000Z" },
    ]),
  );
  const series: TimeBucket[] = [
    { t: "2026-08-26T14:00:00.000Z", label: "9 AM", x: 1, reddit: 0, hn: 0, public: 1, total: 1 },
    { t: "2026-08-26T16:00:00.000Z", label: "11 AM", x: 0, reddit: 0, hn: 0, public: 1, total: 1 },
  ];
  const early = postsInBucket(posts, series, series[0].t);
  assert.equal(early.length, 1);
  assert.equal(early[0].title, "early");
  assert.equal(postsInBucket(posts, series, null).length, 2);
});

test("topicsInBucket keeps prints with receipts in the window", () => {
  const early = topic("Camry", [
    { title: "early", url: "https://a.test/1", createdAt: "2026-08-26T14:10:00.000Z" },
  ]);
  const later = topic("Tesla", [
    { title: "later", url: "https://a.test/2", createdAt: "2026-08-26T16:10:00.000Z" },
  ]);
  const series: TimeBucket[] = [
    { t: "2026-08-26T14:00:00.000Z", label: "9 AM", x: 1, reddit: 0, hn: 0, public: 1, total: 1 },
    { t: "2026-08-26T16:00:00.000Z", label: "11 AM", x: 0, reddit: 0, hn: 0, public: 1, total: 1 },
  ];
  const inEarly = topicsInBucket([early, later], series, series[0].t);
  assert.deepEqual(inEarly.map((t) => t.label), ["Camry"]);
  assert.equal(topicsInBucket([early, later], series, null).length, 2);
});

test("insightForQuery prefers exact label then alias", () => {
  const camry = fakeInsight("Camry", 0.6, 0.4);
  camry.entity.aliases = ["Camry", "Toyota Camry"];
  const tesla = fakeInsight("Tesla", 0.2, 0.8);
  assert.equal(insightForQuery([tesla, camry], "Toyota Camry")?.entity.label, "Camry");
  assert.equal(insightForQuery([tesla, camry], "tes")?.entity.label, "Tesla");
  assert.equal(insightForQuery([tesla, camry], "  "), null);
});

test("payloadFromQrImageUrl reads chart-API data params", () => {
  assert.equal(
    payloadFromQrImageUrl("https://api.qrserver.com/v1/create-qr-code/?data=https://camry.example/fit"),
    "https://camry.example/fit",
  );
  assert.equal(payloadFromQrImageUrl("https://en.wikipedia.org/wiki/Camry"), null);
});

test("scorePoi honors human labels over host class", () => {
  const camry = entity("Camry");
  const receipts: PoiReceipt[] = [
    receipt({ url: "https://en.wikipedia.org/wiki/Camry", title: "Camry" }),
    receipt({ url: "https://news.test/camry", title: "Camry" }),
    receipt({ url: "https://press.test/camry", title: "Camry" }),
    receipt({ url: "https://blog.test/camry", title: "Camry" }),
  ];
  const labeled = scorePoi(camry, receipts, {
    labels: new Map([["https://news.test/camry", "official"]]),
  });
  const unlabeled = scorePoi(camry, receipts);
  assert.ok(labeled.officialCount > unlabeled.officialCount);
});

test("hostOf strips www and drops junk URLs", () => {
  assert.equal(hostOf("https://www.nhtsa.gov/camry"), "nhtsa.gov");
  assert.equal(hostOf("not-a-url"), "");
  assert.equal(isOfficial("not-a-url", "Camry"), false);
});

test("nextWindowFromSeries peaks when slope and last-step ratio disagree", () => {
  assert.equal(nextWindowFromSeries([5, 10, 9], 0.1, 0.1), "peaking");
  assert.equal(nextWindowFromSeries([20, 10, 12], 0.1, 0.1), "peaking");
  assert.equal(nextWindowFromSeries([20, 10], 0.1, 0.1), "fading");
});

test("occupancyExamples keeps gold official/occupied tags and skips ignore plus off-query titles", () => {
  const camry = entity("Camry");
  const wiki = "https://en.wikipedia.org/wiki/Camry";
  const news = "https://news.test/camry";
  const spam = "https://ads.test/camry";
  const tesla = "https://news.test/tesla";
  const examples = occupancyExamples(
    camry,
    [
      receipt({ url: wiki, title: "Camry" }),
      receipt({ url: news, title: "Camry sale" }),
      receipt({ url: spam, title: "Camry" }),
      receipt({ url: tesla, title: "Tesla" }),
    ],
    new Map([
      [wiki, "official"],
      [news, "occupied"],
      [spam, "ignore"],
    ]),
    new Map([[news, "https://camry.example/fit"]]),
  );
  assert.equal(examples.length, 2);
  assert.equal(examples[0]?.y, 1);
  assert.equal(examples[1]?.y, 0);
  assert.equal(examples[1]?.x[1], 1);
});

test("scorePoi drops ignore tags, counts gold tags, and lets occupancy HistGB classify unlabeled hosts", () => {
  const camry = entity("Camry");
  const wiki = "https://en.wikipedia.org/wiki/Camry";
  const nhtsa = "https://www.nhtsa.gov/camry";
  const news = "https://news.test/camry";
  const ads = "https://ads.test/camry-qr";
  const spam = "https://spam.test/camry";
  const receipts: PoiReceipt[] = [
    receipt({ url: wiki, title: "Camry" }),
    receipt({ url: nhtsa, title: "Camry recall" }),
    receipt({ url: news, title: "Camry sale" }),
    receipt({ url: ads, title: "Camry poster QR" }),
    receipt({ url: spam, title: "Camry" }),
  ];
  const ignored = scorePoi(camry, receipts, {
    labels: new Map([
      [wiki, "official"],
      [news, "occupied"],
      [spam, "ignore"],
    ]),
  });
  assert.equal(ignored.receiptCount, 4);
  assert.equal(ignored.goldTags, 2);
  assert.equal(ignored.thin, false);
  assert.ok(!ignored.occupiers.some((o) => o.url === spam));

  const gold = [];
  for (let i = 0; i < 24; i++) {
    gold.push({
      x: occupancyVector({ officialHost: true, hasQr: false, titleLen: 40, hostHasBrand: true }),
      y: 1,
    });
    gold.push({
      x: occupancyVector({ officialHost: false, hasQr: true, titleLen: 80, hostHasBrand: false }),
      y: 0,
    });
  }
  const occupancyModel = fitHistGb(gold, 2);
  assert.ok(occupancyModel);
  const modeled = scorePoi(
    camry,
    [
      receipt({ url: "https://en.wikipedia.org/wiki/Toyota_Camry", title: "Toyota Camry" }),
      receipt({ url: "https://camry.example/news", title: "Camry" }),
      receipt({ url: "https://news.test/camry-qr", title: "Camry QR flyer that is quite long already" }),
      receipt({ url: "https://ads.test/camry", title: "Occupied Camry poster campaign landing" }),
    ],
    {
      occupancyModel,
      qr: new Map([
        ["https://news.test/camry-qr", "payload"],
        ["https://ads.test/camry", "payload"],
      ]),
    },
  );
  assert.equal(modeled.thin, false);
  assert.ok(modeled.officialCount >= 1, "official host should still score official under occupancy HistGB");
  assert.ok(modeled.occupiedCount >= 1, "QR + unofficial host should score occupied under occupancy HistGB");
  assert.equal(modeled.receiptCount, 4);
});

test("memory model blobs round-trip HistGB JSON", async () => {
  const { readModelBlob, writeModelBlob } = await import("./watchlist-store");
  const id = "test-histgb-blob-d08b";
  const payload = { kind: "histgb", lr: 0.25, stumps: [], samples: 16, classes: 3, trainedAt: "2026-09-01T00:00:00.000Z" };
  await writeModelBlob(id, payload, 16);
  assert.deepEqual(await readModelBlob(id), payload);
});
