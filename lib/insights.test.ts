import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeIndustry } from "./insights-analysis";
import { calculateFootprint } from "./insights-footprint";
import type { IndustryAnalysis, POIData, PublicDataSource } from "./insights-types";

function source(id: string, reliability: number, dataPoints: number): PublicDataSource {
  return {
    id,
    name: id,
    platform: "public",
    category: "news",
    dataPoints,
    lastUpdated: "2026-08-29T00:00:00.000Z",
    reliability,
  };
}

function poi(partial: Partial<POIData> = {}): POIData {
  return {
    id: "camry",
    label: "Camry",
    category: "automotive",
    keywords: ["camry"],
    dataPoints: 12,
    relevanceScore: 0.8,
    ...partial,
  };
}

function close(actual: number, expected: number, eps = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= eps, `${actual} !~ ${expected}`);
}

function analysis(partial: Partial<IndustryAnalysis> = {}): IndustryAnalysis {
  return {
    category: "automotive",
    factors: [],
    constraints: [
      { id: "c0", name: "Safety Standards", threshold: 70, current: 80, met: true, impact: "critical" },
      { id: "c1", name: "Emissions", threshold: 73, current: 80, met: true, impact: "critical" },
      { id: "c2", name: "Quality", threshold: 76, current: 80, met: true, impact: "high" },
      { id: "c3", name: "Cost", threshold: 79, current: 80, met: true, impact: "high" },
    ],
    variables: [],
    score: 80,
    insights: [],
    ...partial,
  };
}

test("analyzeIndustry is deterministic and derives trend from coverage, not chance", async () => {
  const strong = [source("a", 0.9, 8000), source("b", 0.9, 8000)];
  const first = await analyzeIndustry("technology", poi({ category: "technology" }), strong);
  const second = await analyzeIndustry("technology", poi({ category: "technology" }), strong);
  assert.equal(first.score, second.score);
  assert.deepEqual(first.factors, second.factors);
  assert.deepEqual(first.constraints, second.constraints);
  assert.deepEqual(first.variables, second.variables);
  assert.ok(first.factors.length > 0);
  assert.ok(first.factors.every((f) => f.trend === "up"));
  assert.ok(first.factors.some((f) => f.name.includes("Rate") && f.unit === "%"));
  assert.ok(Number.isFinite(first.score));

  const weak = await analyzeIndustry("technology", poi({ category: "technology" }), [
    source("thin", 0.5, 500),
  ]);
  assert.ok(weak.factors.every((f) => f.trend === "down"));

  const mid = await analyzeIndustry("finance", poi({ category: "finance" }), [
    source("mid", 0.8, 5000),
  ]);
  assert.ok(mid.factors.every((f) => f.trend === "stable"));
});

test("analyzeIndustry constraint met flags and variable types follow the source metrics", async () => {
  const strong = [source("a", 0.9, 8000), source("b", 0.9, 8000)];
  const result = await analyzeIndustry("automotive", poi(), strong);
  assert.equal(result.constraints[0].threshold, 70);
  assert.equal(result.constraints[1].threshold, 73);
  assert.ok(result.constraints[0].met);
  assert.equal(result.constraints[0].impact, "critical");

  const numeric = result.variables.find((v) => v.type === "numeric");
  const flag = result.variables.find((v) => v.type === "boolean");
  const tier = result.variables.find((v) => v.type === "categorical");
  assert.equal(numeric?.value, 109);
  assert.equal(flag?.value, true);
  assert.equal(tier?.value, "A");

  const poor = await analyzeIndustry("automotive", poi(), [source("poor", 0.6, 100)]);
  assert.equal(poor.variables.find((v) => v.type === "boolean")?.value, false);
  assert.equal(poor.variables.find((v) => v.type === "categorical")?.value, "D");
});

test("calculateFootprint percentiles are derived from values vs benchmarks, not random", async () => {
  const sources = Array.from({ length: 10 }, (_, i) => source(`s${i}`, 0.9, 1000));
  const print = await calculateFootprint(poi(), sources, analysis());
  const again = await calculateFootprint(poi(), sources, analysis());
  assert.deepEqual(print, again);

  assert.equal(print.infiltrationScore, 94);
  close(print.marketPenetration, 94 * 0.95 * 0.85);
  assert.equal(print.reach, 100);
  close(print.engagement, 94 * 0.9 * 1.1);
  close(print.organicRatio, 0.9 * 0.85 + 0.94 * 0.15);

  const byName = Object.fromEntries(print.metrics.map((m) => [m.metric, m]));
  assert.equal(byName["Visibility Score"].percentile, 84);
  assert.equal(byName["Market Share Estimate"].percentile, 85);
  assert.equal(byName["Engagement Rate"].percentile, 87);
  assert.equal(byName["Organic Spread"].percentile, 76);
  assert.equal(byName["Cross-Platform Presence"].percentile, 95);
  assert.ok(print.metrics.every((m) => m.percentile >= 10 && m.percentile <= 95));
  assert.ok(print.metrics.every((m) => m.trend === "increasing"));

  assert.equal(print.dollarImpact.range[0], Math.floor(print.dollarImpact.estimated * 0.7));
  assert.equal(print.dollarImpact.range[1], Math.floor(print.dollarImpact.estimated * 1.4));
  assert.ok(print.dollarImpact.estimated > 0);
});

test("calculateFootprint floors weak percentiles at 10 and maps sentiment from the analysis", async () => {
  const thin = await calculateFootprint(
    poi({ relevanceScore: 0.1 }),
    [source("one", 0.4, 100)],
    analysis({ score: 30, constraints: analysis().constraints.map((c) => ({ ...c, met: false })) }),
  );
  assert.ok(thin.metrics.every((m) => m.percentile >= 10));
  assert.equal(
    thin.metrics.find((m) => m.metric === "Visibility Score")?.percentile,
    10,
  );
  assert.equal(thin.sentiment, "negative");

  const upbeat = await calculateFootprint(
    poi(),
    Array.from({ length: 10 }, (_, i) => source(`s${i}`, 0.9, 1000)),
    analysis(),
  );
  assert.equal(upbeat.sentiment, "positive");

  const mixed = await calculateFootprint(
    poi(),
    [source("m", 0.8, 4000)],
    analysis({
      score: 50,
      constraints: [
        { id: "c0", name: "A", threshold: 70, current: 80, met: true, impact: "critical" },
        { id: "c1", name: "B", threshold: 70, current: 10, met: false, impact: "critical" },
      ],
    }),
  );
  assert.equal(mixed.sentiment, "mixed");
});
