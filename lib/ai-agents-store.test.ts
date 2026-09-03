import assert from "node:assert/strict";
import { test } from "node:test";
import { AIAgentsStore, getAIAgentsStore, parseAgentFilter } from "./ai-agents-store";
import type { AIAgent } from "./ai-agents-types";

function none() {
  return {
    category: null,
    provider: null,
    trending: null,
    minMentions: null,
    pricingTier: null,
  };
}

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

test("parseAgentFilter omits empty category, treats only trending=true as true, and keeps minMentions=0", () => {
  assert.deepEqual(parseAgentFilter(none()), {});
  assert.deepEqual(parseAgentFilter({ ...none(), category: "" }), {});
  assert.deepEqual(parseAgentFilter({ ...none(), category: "code-generation" }), {
    category: "code-generation",
  });
  assert.deepEqual(parseAgentFilter({ ...none(), trending: "true" }), { trending: true });
  assert.deepEqual(parseAgentFilter({ ...none(), trending: "false" }), { trending: false });
  assert.deepEqual(parseAgentFilter({ ...none(), trending: "" }), { trending: false });
  assert.deepEqual(parseAgentFilter({ ...none(), minMentions: "0" }), { minMentions: 0 });
  assert.deepEqual(parseAgentFilter({ ...none(), minMentions: "25" }), { minMentions: 25 });
  const nan = parseAgentFilter({ ...none(), minMentions: "abc" });
  assert.ok(Number.isNaN(nan.minMentions));
});

test("seed catalog is eight unique agents and filters by seed fields only", () => {
  const store = new AIAgentsStore();
  const all = store.getAll();
  const ids = all.map((a) => a.id);
  assert.equal(all.length, 8);
  assert.equal(new Set(ids).size, 8);
  assert.equal(store.getById("gpt-4")?.name, "GPT-4");
  assert.equal(store.getById("missing"), undefined);
  assert.equal(store.getAll({ category: "code-generation" }).length, 3);
  assert.equal(store.getAll({ provider: "openai" }).length, 2);
  assert.equal(store.getAll({ pricingTier: "free" }).length, 1);
  assert.equal(store.getAll({ pricingTier: "free" })[0].id, "llama-3");
  assert.equal(store.getAll({ category: "enterprise" }).length, 0);
});

test("invalid parsed category or NaN minMentions match nobody; minMentions=0 matches the catalog", () => {
  const store = new AIAgentsStore();
  const bogus = parseAgentFilter({ ...none(), category: "not-a-category" });
  assert.equal(store.getAll(bogus).length, 0);
  const nanMentions = parseAgentFilter({ ...none(), minMentions: "nope" });
  assert.equal(store.getAll(nanMentions).length, 0);
  const zeroMentions = parseAgentFilter({ ...none(), minMentions: "0" });
  assert.equal(store.getAll(zeroMentions).length, 8);
});

test("getPayload metadata totals match the filtered catalog and trends stay empty", () => {
  const store = new AIAgentsStore();
  const payload = store.getPayload({ provider: "openai" });
  assert.equal(payload.agents.length, 2);
  assert.equal(payload.metadata.total, 2);
  assert.deepEqual(payload.trends, []);
  const categorySum = Object.values(payload.metadata.byCategory).reduce((n, c) => n + c, 0);
  const providerSum = Object.values(payload.metadata.byProvider).reduce((n, c) => n + c, 0);
  assert.equal(categorySum, 2);
  assert.equal(providerSum, 2);
  assert.equal(payload.metadata.byProvider.openai, 2);
});

test("getAIAgentsStore returns a singleton", () => {
  assert.equal(getAIAgentsStore(), getAIAgentsStore());
});

test("generateInsights requires capability >= 95, rising weekly_change > 20, and a release younger than 3 months", () => {
  const store = new AIAgentsStore();
  const now = Date.now();
  const isoDaysAgo = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const insights = store.generateInsights([
    agent({
      id: "lead",
      name: "Lead",
      capabilities: [{ name: "Code Generation", description: "", score: 95 }],
      metrics: { mentions: 10, sentiment: "neutral", velocity: "rising", trending: true, trend_score: 80, weekly_change: 20.1 },
      releases: [{ version: "2.0", date: isoDaysAgo(30), features: ["new"] }],
    }),
    agent({
      id: "near",
      name: "Near",
      capabilities: [{ name: "Code Generation", description: "", score: 94 }],
      metrics: { mentions: 10, sentiment: "neutral", velocity: "rising", trending: false, trend_score: 40, weekly_change: 20 },
      releases: [{ version: "1.0", date: isoDaysAgo(120), features: ["old"] }],
    }),
    agent({
      id: "peak",
      name: "Peak",
      capabilities: [{ name: "Speed", description: "", score: 99 }],
      metrics: { mentions: 10, sentiment: "neutral", velocity: "peaking", trending: true, trend_score: 70, weekly_change: 40 },
      releases: [],
    }),
  ]);

  const capability = insights.filter((i) => i.type === "capability");
  assert.equal(capability.length, 2);
  assert.ok(capability.some((i) => i.title === "Code Generation Leadership" && i.agents[0] === "Lead"));
  assert.ok(capability.some((i) => i.title === "Speed Leadership" && i.agents[0] === "Peak"));
  assert.ok(!capability.some((i) => i.agents.includes("Near")));

  const adoption = insights.find((i) => i.type === "adoption");
  assert.equal(adoption?.agents.length, 1);
  assert.deepEqual(adoption?.agents, ["Lead"]);

  const innovation = insights.find((i) => i.type === "innovation");
  assert.deepEqual(innovation?.agents, ["Lead"]);
});
