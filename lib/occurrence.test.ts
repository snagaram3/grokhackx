import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEventTicks, eventKindOf } from "./event-ticks";
import { cronAuthorized, requestOrigin } from "./hourly-collect";
import { alignTotals, historyMarks, xAtTime } from "./occurrence-overlay";
import type { TimeBucket, Topic } from "./types";

function emptySlice() {
  return { score: 0, posts: [] as Topic["platforms"]["public"]["posts"] };
}

function topicFromParts(parts: Partial<Topic["platforms"]>): Topic {
  return {
    id: "camry",
    label: "Camry",
    velocity: "rising",
    divergence: 0.2,
    tickers: [],
    platforms: {
      x: emptySlice(),
      reddit: emptySlice(),
      hn: emptySlice(),
      public: emptySlice(),
      ...parts,
    },
  };
}

test("eventKindOf maps GDELT and NWS source names only", () => {
  assert.equal(eventKindOf("GDELT"), "gdelt");
  assert.equal(eventKindOf("National Weather Service"), "nws");
  assert.equal(eventKindOf("Open Library"), null);
});

test("buildEventTicks lags GDELT against first social print and never invents a WHY", () => {
  const social = topicFromParts({
    hn: {
      score: 12,
      posts: [
        {
          platform: "hn",
          title: "Camry hybrid thread",
          url: "https://hn.test/1",
          score: 12,
          createdAt: "2026-08-26T12:00:00.000Z",
        },
      ],
    },
    public: {
      score: 20,
      posts: [
        {
          platform: "public",
          title: "Camry in world news",
          url: "https://gdelt.test/camry",
          score: 70,
          createdAt: "2026-08-26T15:00:00.000Z",
          sourceApi: "GDELT",
        },
        {
          platform: "public",
          title: "Heat advisory",
          url: "https://api.weather.gov/alerts/1",
          score: 80,
          createdAt: "2026-08-27T16:00:00.000Z",
          sourceApi: "NWS",
        },
      ],
    },
  });

  const ticks = buildEventTicks([social]);
  assert.equal(ticks.length, 2);
  const gdelt = ticks.find((t) => t.kind === "gdelt");
  const nws = ticks.find((t) => t.kind === "nws");
  assert.equal(gdelt?.lagHours, 3);
  assert.equal(gdelt?.inWindow, true);
  assert.equal(nws?.inWindow, false);
  assert.equal(gdelt?.title, "Camry in world news");
});

test("alignTotals maps overlay windows onto primary without inventing overlap", () => {
  const primary: TimeBucket[] = [
    { t: "2026-08-26T12:00:00.000Z", label: "12 PM", x: 0, reddit: 0, hn: 2, public: 1, total: 3 },
    { t: "2026-08-26T13:00:00.000Z", label: "1 PM", x: 0, reddit: 0, hn: 1, public: 4, total: 5 },
  ];
  const overlay: TimeBucket[] = [
    { t: "2026-08-26T12:00:00.000Z", label: "12 PM", x: 0, reddit: 0, hn: 0, public: 8, total: 8 },
    { t: "2026-08-26T15:00:00.000Z", label: "3 PM", x: 0, reddit: 0, hn: 0, public: 9, total: 9 },
  ];
  assert.deepEqual(alignTotals(primary, overlay), [8, 0]);
});

test("historyMarks stay off the chart until two snapshots exist", () => {
  const series: TimeBucket[] = [
    { t: "2026-08-26T12:00:00.000Z", label: "12 PM", x: 0, reddit: 0, hn: 1, public: 0, total: 1 },
    { t: "2026-08-26T13:00:00.000Z", label: "1 PM", x: 0, reddit: 0, hn: 2, public: 0, total: 2 },
  ];
  assert.equal(historyMarks(series, [{ at: "2026-08-26T12:30:00.000Z", score: 10, receipts: 4 }]).length, 0);
  assert.equal(
    historyMarks(series, [
      { at: "2026-08-26T12:10:00.000Z", score: 10, receipts: 4 },
      { at: "2026-08-26T12:50:00.000Z", score: 12, receipts: 6 },
    ]).length,
    2,
  );
  const x = xAtTime("2026-08-26T12:30:00.000Z", series, 100);
  assert.ok(x !== null && x > 40 && x < 60);
});

test("cronAuthorized allows local when CRON_SECRET is unset", () => {
  const prev = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  assert.equal(cronAuthorized(new Request("http://localhost/api/collect?hourly=1")), true);
  process.env.CRON_SECRET = "secret";
  assert.equal(
    cronAuthorized(
      new Request("http://localhost/api/collect?hourly=1", { headers: { authorization: "Bearer secret" } }),
    ),
    true,
  );
  assert.equal(cronAuthorized(new Request("http://localhost/api/collect?hourly=1")), false);
  if (prev === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = prev;
});

test("requestOrigin prefers forwarded host, then Vercel, then local", () => {
  const prevVercel = process.env.VERCEL_URL;
  delete process.env.VERCEL_URL;
  assert.equal(
    requestOrigin(
      new Request("http://localhost/api/collect", {
        headers: { "x-forwarded-host": "hawkxai.example", "x-forwarded-proto": "https" },
      }),
    ),
    "https://hawkxai.example",
  );
  assert.equal(
    requestOrigin(new Request("http://localhost/api/collect", { headers: { host: "127.0.0.1:3001" } })),
    "http://127.0.0.1:3001",
  );
  process.env.VERCEL_URL = "app.vercel.app";
  assert.equal(requestOrigin(new Request("http://localhost/api/collect")), "https://app.vercel.app");
  process.env.VERCEL_URL = "https://already.vercel.app";
  assert.equal(requestOrigin(new Request("http://localhost/api/collect")), "https://already.vercel.app");
  delete process.env.VERCEL_URL;
  assert.equal(requestOrigin(new Request("http://localhost/api/collect")), "http://localhost:3001");
  if (prevVercel === undefined) delete process.env.VERCEL_URL;
  else process.env.VERCEL_URL = prevVercel;
});
