import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ageTranslations,
  campaignMove,
  captureArtifacts,
  improvisationsFor,
  topicRisk,
  whyTrending,
} from "./booster";
import type { Post, Topic, TrendsPayload } from "./types";

function emptySlice() {
  return { score: 0, posts: [] as Post[] };
}

function topic(partial: Partial<Topic> & Pick<Topic, "id" | "label">): Topic {
  return {
    velocity: "rising",
    divergence: 0.4,
    tickers: [],
    platforms: { x: emptySlice(), reddit: emptySlice(), hn: emptySlice(), public: emptySlice() },
    ...partial,
  };
}

function post(title: string, extra: Partial<Post> = {}): Post {
  return {
    platform: "x",
    title,
    url: extra.url ?? `https://x.test/${encodeURIComponent(title.slice(0, 24))}`,
    score: extra.score ?? 20,
    createdAt: extra.createdAt ?? "2026-08-26T12:00:00.000Z",
    ...extra,
  };
}

test("captureArtifacts keeps hashtags, tickers, QR payloads, and ordinary URLs apart", () => {
  const campaign = topic({
    id: "heat",
    label: "#HeatWaveFit drop",
    tickers: [{ symbol: "DAL", sentiment: "neg", mentions: 2 }],
    platforms: {
      x: {
        score: 80,
        posts: [
          post("Scan this QR for the #HeatWaveFit drop https://qrco.de/hwfit?utm_medium=qr", {
            url: "https://x.test/status/1",
          }),
          post("Poster chart https://chart.googleapis.com/chart?cht=qr&chl=https://camry.example/fit", {
            url: "https://x.test/status/2",
          }),
        ],
      },
      reddit: emptySlice(),
      hn: emptySlice(),
      public: {
        score: 10,
        posts: [post("Toyota Camry", { platform: "public", url: "https://en.wikipedia.org/wiki/Toyota_Camry" })],
      },
    },
  });

  const arts = captureArtifacts(campaign);
  const byKind = (kind: (typeof arts)[number]["kind"]) => arts.filter((a) => a.kind === kind);

  assert.ok(byKind("hashtag").some((a) => a.value === "#HeatWaveFit"));
  assert.ok(byKind("ticker").some((a) => a.value === "$DAL"));
  assert.ok(byKind("qr").some((a) => a.value === "https://camry.example/fit"));
  assert.ok(byKind("qr").some((a) => /qrco\.de/i.test(a.value) || /utm_medium=qr/i.test(a.value)));
  assert.ok(byKind("url").some((a) => a.value.includes("wikipedia.org")));
  assert.equal(
    byKind("url").some((a) => a.value.includes("chart.googleapis.com")),
    false,
  );
});

test("captureArtifacts records a QR mention when no scannable payload exists", () => {
  const mentioned = topic({
    id: "poster",
    label: "Camry posters",
    platforms: {
      x: { score: 12, posts: [post("Scan this QR at the dealer lot — no link yet")] },
      reddit: emptySlice(),
      hn: emptySlice(),
      public: emptySlice(),
    },
  });
  const arts = captureArtifacts(mentioned);
  assert.ok(arts.some((a) => a.kind === "qr" && /no scannable payload/i.test(a.value)));
});

test("whyTrending abstains with no receipts and does not invent a cause", () => {
  const empty = topic({ id: "camry", label: "Camry" });
  const thin = whyTrending(empty, []);
  assert.equal(thin.confidence, 0.2);
  assert.match(thin.why, /Do not invent a why/);

  const bubble = topic({
    id: "outage",
    label: "Airline app outage",
    velocity: "rising",
    divergence: 0.8,
    platforms: {
      x: { score: 71, posts: [post("Outage: $DAL app down")] },
      reddit: emptySlice(),
      hn: emptySlice(),
      public: emptySlice(),
    },
  });
  const why = whyTrending(bubble, captureArtifacts(bubble));
  assert.ok(why.confidence > 0.2);
  assert.match(why.why, /early window/);
  assert.equal(/invent/i.test(why.why), false);

  const cooling = topic({
    id: "old",
    label: "Old print",
    velocity: "fading",
    platforms: {
      x: { score: 8, posts: [post("recap thread")] },
      reddit: emptySlice(),
      hn: emptySlice(),
      public: emptySlice(),
    },
  });
  assert.match(whyTrending(cooling, []).why, /Cooling/);
});

test("campaignMove recaps fading waves and flags controversy as high risk", () => {
  const hot = [{ kind: "hashtag" as const, value: "#TravelFail", mentions: 2, platforms: ["x" as const] }];
  const fade = campaignMove(topic({ id: "old", label: "Airline app outage", velocity: "fading" }), hot);
  assert.equal(fade.angle, "Recap, don't launch");
  assert.equal(fade.timing, "fading");
  assert.match(fade.hook, /cooling wave/i);

  const bubble = campaignMove(
    topic({ id: "bubble", label: "Camry", velocity: "rising", divergence: 0.7 }),
    hot,
  );
  assert.equal(bubble.angle, "Win the source that's moving first");
  assert.equal(bubble.risk, "low");

  const recall = campaignMove(
    topic({
      id: "recall",
      label: "Camry",
      velocity: "rising",
      divergence: 0.2,
      platforms: {
        x: { score: 40, posts: [post("Camry recall lawsuit")] },
        reddit: emptySlice(),
        hn: emptySlice(),
        public: emptySlice(),
      },
    }),
    [],
  );
  assert.equal(recall.risk, "high");
  assert.equal(recall.angle, "Sell the job underneath");
});

test("topicRisk and kids lens stay conservative", () => {
  assert.equal(
    topicRisk(
      topic({
        id: "hack",
        label: "Outage",
        platforms: {
          x: { score: 10, posts: [post("app hack leak")] },
          reddit: emptySlice(),
          hn: emptySlice(),
          public: emptySlice(),
        },
      }),
    ),
    "high",
  );
  assert.equal(topicRisk(topic({ id: "fade", label: "Camry", velocity: "fading" })), "medium");
  assert.equal(topicRisk(topic({ id: "peak", label: "Camry", velocity: "peaking" })), "medium");
  assert.equal(topicRisk(topic({ id: "rise", label: "Camry", velocity: "rising" })), "low");

  const kids = ageTranslations(topic({ id: "qr", label: "#HeatWaveFit" })).find((a) => a.lens === "kids");
  assert.ok(kids);
  assert.match(kids!.takeaway, /parent/i);
  assert.match(kids!.takeaway, /QR/i);
});

test("captureArtifacts leftover short links stay QR campaign codes, not ordinary URLs", () => {
  const shorts = topic({
    id: "shorts",
    label: "Camry drop",
    platforms: {
      x: {
        score: 40,
        posts: [
          post("tiny https://tinyurl.com/camry-lot", { url: "https://x.test/status/tiny" }),
          post("linkedin https://lnkd.in/camry", { url: "https://x.test/status/lnkd" }),
          post("goo https://goo.gl/camry", { url: "https://x.test/status/goo" }),
          post("owl https://ow.ly/camry", { url: "https://x.test/status/owl" }),
        ],
      },
      reddit: emptySlice(),
      hn: emptySlice(),
      public: emptySlice(),
    },
  });
  const arts = captureArtifacts(shorts);
  const urls = arts.filter((a) => a.kind === "url").map((a) => a.value);
  const qrs = arts.filter((a) => a.kind === "qr").map((a) => a.value);
  assert.ok(qrs.some((v) => /tinyurl\.com/i.test(v)));
  assert.ok(qrs.some((v) => /lnkd\.in/i.test(v)));
  assert.ok(qrs.some((v) => /goo\.gl/i.test(v)));
  assert.ok(qrs.some((v) => /ow\.ly/i.test(v)));
  assert.equal(urls.some((v) => /tinyurl|lnkd\.in|goo\.gl|ow\.ly/i.test(v)), false);
});

test("campaignMove leftover high-divergence controversy stays a high-risk first-source win", () => {
  const move = campaignMove(
    topic({
      id: "bubble-risk",
      label: "Camry",
      velocity: "rising",
      divergence: 0.7,
      platforms: {
        x: { score: 40, posts: [post("Camry lawsuit filed")] },
        reddit: emptySlice(),
        hn: emptySlice(),
        public: emptySlice(),
      },
    }),
    [{ kind: "hashtag", value: "#Camry", mentions: 2, platforms: ["x"] }],
  );
  assert.equal(move.angle, "Win the source that's moving first");
  assert.equal(move.risk, "high");
});

test("whyTrending leftover ordinary URLs print Traffic on the host", () => {
  const wired = topic({
    id: "wiki",
    label: "Camry",
    platforms: {
      x: emptySlice(),
      reddit: emptySlice(),
      hn: emptySlice(),
      public: {
        score: 10,
        posts: [post("Toyota Camry", { platform: "public", url: "https://en.wikipedia.org/wiki/Toyota_Camry" })],
      },
    },
  });
  const why = whyTrending(wired, captureArtifacts(wired));
  assert.match(why.why, /Traffic on en.wikipedia.org/);
});

test("topicRisk leftover controversy words stay high", () => {
  const risky = (title: string) =>
    topicRisk(
      topic({
        id: title,
        label: "Camry",
        platforms: {
          x: { score: 10, posts: [post(title)] },
          reddit: emptySlice(),
          hn: emptySlice(),
          public: emptySlice(),
        },
      }),
    );
  for (const word of [
    "leak",
    "crash",
    "war",
    "death",
    "killed",
    "abuse",
    "lawsuit",
    "ban",
    "outage",
    "recall",
    "protest",
  ]) {
    assert.equal(risky(`Camry ${word} notice`), "high", word);
  }
});

test("improvisationsFor leftover TikTok and Postgres rows stay ranked, and 3 hashtags skip Shorts", () => {
  const emptyBriefs = improvisationsFor(
    {
      topics: [topic({ id: "camry", label: "Camry" })],
      updatedAt: "2026-08-26T12:00:00.000Z",
      sources: { x: true, reddit: true, hn: true, public: true },
      degraded: [],
    },
    [],
  );
  assert.ok(emptyBriefs.some((i) => /TikTok|Shorts/i.test(i.title) && i.priority === "P0"));
  assert.ok(emptyBriefs.some((i) => /Postgres/i.test(i.title) && i.priority === "P2"));

  const tagged = improvisationsFor(
    {
      topics: [topic({ id: "camry", label: "Camry" })],
      updatedAt: "2026-08-26T12:00:00.000Z",
      sources: { x: true, reddit: true, hn: true, public: true },
      degraded: [],
    },
    [
      {
        topicId: "camry",
        whyTrending: "",
        confidence: 0.4,
        category: "markets",
        artifacts: [
          { kind: "hashtag", value: "#Camry", mentions: 1, platforms: ["x"] },
          { kind: "hashtag", value: "#Toyota", mentions: 1, platforms: ["x"] },
          { kind: "hashtag", value: "#Hybrid", mentions: 1, platforms: ["x"] },
        ],
        audiences: [],
        campaign: { angle: "", forCompetitors: "", risk: "low", timing: "rising", hook: "" },
        causation: {
          topicId: "camry",
          firstAt: null,
          firstPlatform: null,
          lagHours: null,
          peakAt: null,
          drivers: [],
          thin: true,
        },
        sentiment: {
          topicId: "camry",
          lean: "thin",
          overall: { pos: 0, neg: 0, risk: 0, n: 0 },
          byPlatform: {},
          drivers: [],
          quotes: [],
          hits: [],
          thin: true,
        },
      },
    ],
  );
  assert.equal(tagged.some((i) => /TikTok|Shorts/i.test(i.title)), false);
});

test("improvisationsFor ranks ingest gaps as P0 and never invents a ticker overlay", () => {
  const payload: TrendsPayload = {
    topics: [topic({ id: "camry", label: "Camry", divergence: 0.8 })],
    updatedAt: "2026-08-26T12:00:00.000Z",
    sources: { x: false, reddit: true, hn: true, public: false },
    degraded: ["x 401"],
  };
  const items = improvisationsFor(payload, []);
  assert.ok(items.some((i) => i.title === "Stabilize X ingest" && i.priority === "P0"));
  assert.ok(items.some((i) => i.title === "Public-API ingest is offline" && i.priority === "P0"));
  assert.ok(items.some((i) => /QR image decode/i.test(i.title)));
  assert.equal(items[0].priority, "P0");
  const finance = items.find((i) => /Finance overlay/i.test(i.title));
  assert.ok(finance);
  assert.match(finance!.next, /never invent symbols/i);
});
