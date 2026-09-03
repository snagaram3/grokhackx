import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compareAgents,
  generateComparisonMarkdown,
  parseCompareIds,
} from "./ai-agents-compare";
import type { AIAgent } from "./ai-agents-types";

function agent(partial: Partial<AIAgent> & Pick<AIAgent, "id" | "name">): AIAgent {
  return {
    provider: "other",
    category: "analysis",
    description: "",
    capabilities: [{ name: "Code", description: "", score: 90 }],
    pricing: { tier: "paid", inputCost: 10, outputCost: 10, currency: "USD" },
    metrics: {
      mentions: 100,
      sentiment: "neutral",
      velocity: "stable",
      trending: false,
      trend_score: 50,
      weekly_change: 0,
    },
    releases: [],
    launchDate: "2024-01-01",
    lastUpdated: "2026-09-01T00:00:00.000Z",
    tags: [],
    ...partial,
  };
}

test("parseCompareIds rejects missing, thin, and oversized id lists", () => {
  assert.deepEqual(parseCompareIds(null), {
    ok: false,
    status: 400,
    error: "Missing 'ids' parameter. Provide comma-separated agent IDs.",
  });
  assert.deepEqual(parseCompareIds(""), {
    ok: false,
    status: 400,
    error: "Missing 'ids' parameter. Provide comma-separated agent IDs.",
  });
  assert.equal(parseCompareIds("gpt-4").ok, false);
  assert.equal(parseCompareIds("  ,  ").ok, false);
  const seven = parseCompareIds("a,b,c,d,e,f,g");
  assert.deepEqual(seven, {
    ok: false,
    status: 400,
    error: "Maximum 6 agents can be compared at once",
  });
});

test("parseCompareIds trims crumbs, keeps duplicates, and caps at six", () => {
  assert.deepEqual(parseCompareIds("gpt-4, claude-3.5-sonnet"), {
    ok: true,
    ids: ["gpt-4", "claude-3.5-sonnet"],
  });
  assert.deepEqual(parseCompareIds("gpt-4, , gpt-4"), {
    ok: true,
    ids: ["gpt-4", "gpt-4"],
  });
  assert.deepEqual(parseCompareIds("a,b,c,d,e,f"), {
    ok: true,
    ids: ["a", "b", "c", "d", "e", "f"],
  });
});

test("compareAgents returns empty summaries when no agents are passed", () => {
  const empty = compareAgents([]);
  assert.deepEqual(empty.agents, []);
  assert.deepEqual(empty.capabilities, []);
  assert.deepEqual(empty.pricing, []);
  assert.deepEqual(empty.metrics, []);
  assert.deepEqual(empty.summary, {
    overallLeader: "",
    bestValue: "",
    fastest: "",
    mostCapable: "",
  });
  assert.deepEqual(empty.insights, []);
});

test("compareAgents ranks capability leaders and averages only agents that list the skill", () => {
  const result = compareAgents([
    agent({
      id: "alpha",
      name: "Alpha",
      capabilities: [
        { name: "Code", description: "", score: 80 },
        { name: "Safety", description: "", score: 99 },
      ],
    }),
    agent({
      id: "beta",
      name: "Beta",
      capabilities: [{ name: "Code", description: "", score: 95 }],
    }),
  ]);

  const code = result.capabilities.find((c) => c.name === "Code");
  const safety = result.capabilities.find((c) => c.name === "Safety");
  assert.equal(code?.leader, "beta");
  assert.equal(code?.avgScore, 87.5);
  assert.deepEqual(code?.scores, { alpha: 80, beta: 95 });
  assert.equal(safety?.leader, "alpha");
  assert.equal(safety?.avgScore, 99);
  assert.deepEqual(safety?.scores, { alpha: 99 });
  assert.equal(result.capabilities[0].name, "Safety");
});

test("tied capability scores keep the first agent that listed the skill", () => {
  const result = compareAgents([
    agent({
      id: "first",
      name: "First",
      capabilities: [{ name: "Code", description: "", score: 90 }],
    }),
    agent({
      id: "second",
      name: "Second",
      capabilities: [{ name: "Code", description: "", score: 90 }],
    }),
  ]);
  assert.equal(result.capabilities[0].leader, "first");
});

test("pricing uses a 50/50 1M split, sorts null costs first, and skips them for bestValue", () => {
  const result = compareAgents([
    agent({
      id: "paid",
      name: "Paid",
      pricing: { tier: "paid", inputCost: 30, outputCost: 60, currency: "USD" },
      metrics: { mentions: 10, sentiment: "neutral", velocity: "stable", trending: false, trend_score: 10, weekly_change: 0 },
    }),
    agent({
      id: "free",
      name: "Free",
      pricing: { tier: "free" },
      metrics: { mentions: 10, sentiment: "neutral", velocity: "stable", trending: false, trend_score: 20, weekly_change: 0 },
    }),
    agent({
      id: "zero",
      name: "Zero",
      pricing: { tier: "freemium", inputCost: 0, outputCost: 0, currency: "USD" },
      metrics: { mentions: 10, sentiment: "neutral", velocity: "stable", trending: false, trend_score: 30, weekly_change: 0 },
    }),
  ]);

  assert.equal(result.pricing[0].agentId, "free");
  assert.equal(result.pricing[0].totalCost1M, null);
  assert.equal(result.pricing.find((p) => p.agentId === "paid")?.totalCost1M, 45);
  assert.equal(result.pricing.find((p) => p.agentId === "zero")?.totalCost1M, 0);
  assert.equal(result.summary.bestValue, "zero");
  assert.ok(result.insights.some((line) => line.includes("1 free/open-source option available")));
  assert.ok(result.insights.some((line) => line.includes("Infinityx difference")));
});

test("overallLeader uses trend_score even though returned metrics are re-sorted by weeklyChange", () => {
  const result = compareAgents([
    agent({
      id: "hub",
      name: "Hub",
      metrics: { mentions: 10, sentiment: "positive", velocity: "stable", trending: false, trend_score: 90, weekly_change: 1 },
    }),
    agent({
      id: "rocket",
      name: "Rocket",
      metrics: { mentions: 10, sentiment: "mixed", velocity: "rising", trending: true, trend_score: 40, weekly_change: 25 },
    }),
  ]);

  assert.equal(result.summary.overallLeader, "hub");
  assert.equal(result.summary.fastest, "rocket");
  assert.deepEqual(
    result.metrics.map((m) => m.agentId),
    ["rocket", "hub"],
  );
  assert.ok(result.insights.some((line) => line === "1 agent showing rising adoption"));
  assert.ok(result.insights.some((line) => line === "1/2 agents have positive sentiment"));
});

test("mostCapable averages capability scores; an empty list listed first can win via NaN sort", () => {
  const emptyFirst = compareAgents([
    agent({ id: "blank", name: "Blank", capabilities: [] }),
    agent({
      id: "skilled",
      name: "Skilled",
      capabilities: [
        { name: "Code", description: "", score: 100 },
        { name: "Safety", description: "", score: 100 },
      ],
    }),
  ]);
  assert.equal(emptyFirst.summary.mostCapable, "blank");

  const skilledFirst = compareAgents([
    agent({
      id: "skilled",
      name: "Skilled",
      capabilities: [{ name: "Code", description: "", score: 100 }],
    }),
    agent({ id: "blank", name: "Blank", capabilities: [] }),
  ]);
  assert.equal(skilledFirst.summary.mostCapable, "skilled");
});

test("markdown treats a 0 capability score as missing and labels null free totals as Free", () => {
  const comparison = compareAgents([
    agent({
      id: "zero-cap",
      name: "ZeroCap",
      capabilities: [{ name: "Code", description: "", score: 0 }],
      pricing: { tier: "free" },
      metrics: { mentions: 42, sentiment: "neutral", velocity: "stable", trending: false, trend_score: 10, weekly_change: -2.5 },
    }),
    agent({
      id: "lead",
      name: "Lead",
      capabilities: [{ name: "Code", description: "", score: 88 }],
      pricing: { tier: "paid", inputCost: 2, outputCost: 4, currency: "USD" },
      metrics: { mentions: 10, sentiment: "neutral", velocity: "stable", trending: false, trend_score: 20, weekly_change: 1.2 },
    }),
  ]);
  const md = generateComparisonMarkdown(comparison);
  assert.match(md, /\| Code \| — \| \*\*88\*\* ⭐ \|/);
  assert.match(md, /\| ZeroCap \| free \| — \| — \| Free \|/);
  assert.match(md, /\| Lead \| paid \| \$2 \| \$4 \| \$3\.00 \|/);
  assert.match(md, /\| ZeroCap \| 42 \| stable \| neutral \| -2\.5% \| 10 \|/);
  assert.match(md, /\| Lead \| 10 \| stable \| neutral \| \+1\.2% \| 20 \|/);
});
