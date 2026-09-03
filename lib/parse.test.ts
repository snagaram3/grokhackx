import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCity, trendsCacheKey } from "./geo";
import { payloadFromQrImageUrl } from "./qr";
import { vehicleQuery } from "./public-apis";
import { formatResearchBrief, researchBriefFilename } from "./research-brief";
import { clusteredListSchema, xTrendSchema, whyItemSchema } from "./schemas";
import { databaseName, isTrendDatabase, readTrendDbConfig } from "./trend-db";
import { ucb } from "./rl";
import type { ResearchPayload } from "./types";

test("parseCity maps aliases and unknown cities to world", () => {
  assert.equal(parseCity("London"), "london");
  assert.equal(parseCity("São Paulo"), "saopaulo");
  assert.equal(parseCity("new york city"), "nyc");
  assert.equal(parseCity("san fran"), "sf");
  assert.equal(parseCity("not-a-city"), "all");
  assert.equal(parseCity(null), "all");
  assert.equal(trendsCacheKey("NYC", "Camry"), "trends:v2:nyc:topic:camry");
  assert.equal(trendsCacheKey(undefined, "  "), "trends:v2:all");
});

test("vehicleQuery maps Camry aliases and years, never camera", () => {
  assert.deepEqual(vehicleQuery("Camry"), { make: "toyota", model: "camry" });
  assert.deepEqual(vehicleQuery("2024 Honda Civic"), { make: "honda", model: "civic", year: "2024" });
  assert.equal(vehicleQuery("camera sensor"), null);
  assert.equal(vehicleQuery("   "), null);
});

test("QR image URLs decode data/text/chl and ignore ordinary pages", () => {
  assert.equal(
    payloadFromQrImageUrl("https://chart.googleapis.com/chart?cht=qr&chl=https://camry.example/fit"),
    "https://camry.example/fit",
  );
  assert.equal(
    payloadFromQrImageUrl("https://api.qrserver.com/v1/create-qr-code/?text=%23HeatWaveFit"),
    "#HeatWaveFit",
  );
  assert.equal(payloadFromQrImageUrl("https://en.wikipedia.org/wiki/Camry"), null);
  assert.equal(payloadFromQrImageUrl("not a url"), null);
});

test("zod schemas clamp X volume and reject empty cluster lists", () => {
  assert.equal(xTrendSchema.parse({ topic: "Camry", volume: 140 }).volume, 100);
  assert.equal(xTrendSchema.parse({ topic: "Camry", volume: -4 }).volume, 0);
  assert.throws(() => clusteredListSchema.parse({ topics: [] }));
  assert.equal(whyItemSchema.parse({ id: "t1", why: "x".repeat(400) }).why.length, 280);
});

test("research brief lists dropped receipts and marks the default sense", () => {
  assert.equal(researchBriefFilename("Toyota Camry!!"), "hawkxai-research-toyota-camry.md");
  const payload: ResearchPayload = {
    query: "apple",
    updatedAt: "2026-08-26T00:00:00Z",
    summary: "Collected 2 live receipts.",
    findings: [{ claim: "Fruit page exists", evidenceIds: ["w1"], confidence: "high" }],
    openQuestions: [],
    angles: ["Primary sources: wikipedia"],
    sources: [
      {
        id: "w1",
        kind: "wikipedia",
        title: "Apple",
        url: "https://en.wikipedia.org/wiki/Apple",
        snippet: "fruit",
      },
    ],
    degraded: [],
    thin: false,
    droppedCount: 1,
    dropped: [{ title: "WorldNews live thread", url: "https://reddit.test/worldnews" }],
    senses: [
      { id: "apple", label: "Apple", count: 1, sourceIds: ["w1"] },
      { id: "apple-inc", label: "Apple Inc.", count: 4, sourceIds: ["hn-1"] },
    ],
    defaultSenseId: "apple",
  };
  const md = formatResearchBrief(payload);
  assert.match(md, /Dropped: 1 unrelated/);
  assert.match(md, /WorldNews live thread/);
  assert.match(md, /Apple · 1 receipts · this copy/);
  assert.match(md, /Evidence only/);
});

test("trend db names stay category-scoped and config abstains without host/user", () => {
  assert.equal(isTrendDatabase("markets"), true);
  assert.equal(isTrendDatabase("tape"), false);
  assert.equal(databaseName("news", "hawkxai"), "hawkxai_news");
  const prev = {
    host: process.env.TREND_DB_HOST,
    user: process.env.TREND_DB_USER,
  };
  delete process.env.TREND_DB_HOST;
  delete process.env.TREND_DB_USER;
  assert.equal(readTrendDbConfig(), null);
  if (prev.host === undefined) delete process.env.TREND_DB_HOST;
  else process.env.TREND_DB_HOST = prev.host;
  if (prev.user === undefined) delete process.env.TREND_DB_USER;
  else process.env.TREND_DB_USER = prev.user;
});

test("ucb explores unpulled arms first", () => {
  assert.equal(ucb({ name: "fresh", pulls: 0, reward: 0 }, 10), Number.POSITIVE_INFINITY);
  const pulled = ucb({ name: "hn", pulls: 4, reward: 2 }, 10);
  assert.ok(pulled > 0.5 && pulled < 2);
});
