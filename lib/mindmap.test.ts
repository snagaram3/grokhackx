import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMindMap, leavesOf, sharedWith } from "./mindmap";
import type { BoosterTopicBrief, Post, Topic } from "./types";

function emptySlice() {
  return { score: 0, posts: [] as Post[] };
}

function topic(id: string, label: string, extra: Partial<Topic> = {}): Topic {
  return {
    id,
    label,
    velocity: "rising",
    divergence: 0.4,
    tickers: [],
    platforms: {
      x: { score: 20, posts: [] },
      reddit: emptySlice(),
      hn: emptySlice(),
      public: emptySlice(),
    },
    ...extra,
  };
}

function brief(
  topicId: string,
  category: BoosterTopicBrief["category"],
  artifacts: BoosterTopicBrief["artifacts"],
): BoosterTopicBrief {
  return {
    topicId,
    whyTrending: "receipts only",
    confidence: 0.4,
    category,
    artifacts,
    audiences: [],
    campaign: { angle: "", forCompetitors: "", risk: "low", timing: "rising", hook: "" },
    causation: {
      topicId,
      firstAt: "2026-08-26T12:00:00.000Z",
      firstPlatform: "x",
      lagHours: 2,
      peakAt: null,
      drivers: [{ id: "heat-x", label: "x heat", weight: 80, evidence: "1 receipt · score 20" }],
      thin: false,
    },
    sentiment: {
      topicId,
      lean: "thin",
      overall: { pos: 0, neg: 0, risk: 0, n: 0 },
      byPlatform: {},
      drivers: [],
      quotes: [],
      hits: [],
      thin: true,
    },
  };
}

test("buildMindMap uses the plugged hub and filters by category", () => {
  const camry = topic("camry", "Camry");
  const storm = topic("storm", "Gulf storm");
  const graph = buildMindMap(
    [camry, storm],
    [brief("camry", "markets", []), brief("storm", "weather", [])],
    "markets",
    { label: "Camry", detail: "1 related prints" },
  );
  assert.equal(graph.hubId, "hub:phrase");
  assert.equal(graph.nodes.find((n) => n.kind === "hub")?.label, "Camry");
  assert.ok(graph.nodes.some((n) => n.topicId === "camry" && n.kind === "topic"));
  assert.equal(
    graph.nodes.some((n) => n.topicId === "storm"),
    false,
  );
});

test("shared artifacts draw amber bridges; unique artifacts do not invent them", () => {
  const tag = { kind: "hashtag" as const, value: "#Camry", mentions: 2, platforms: ["x" as const] };
  const graph = buildMindMap(
    [topic("camry", "Camry"), topic("hybrid", "Camry hybrid")],
    [brief("camry", "markets", [tag]), brief("hybrid", "markets", [tag])],
  );
  assert.ok(graph.bridges >= 1);
  assert.ok(graph.links.some((l) => l.kind === "shared" && l.label === "#camry"));
  const neighbors = sharedWith(graph, "camry");
  assert.deepEqual(
    neighbors.map((n) => n.topicId),
    ["hybrid"],
  );
  assert.equal(neighbors[0].via, "#camry");

  const isolated = buildMindMap(
    [topic("camry", "Camry"), topic("tesla", "Tesla")],
    [
      brief("camry", "markets", [{ kind: "hashtag", value: "#Camry", mentions: 1, platforms: ["x"] }]),
      brief("tesla", "markets", [{ kind: "hashtag", value: "#Tesla", mentions: 1, platforms: ["x"] }]),
    ],
  );
  assert.equal(isolated.bridges, 0);
  assert.equal(sharedWith(isolated, "camry").length, 0);
});

test("leavesOf caps at four and never returns the topic node", () => {
  const arts = ["#A", "#B", "#C", "#D"].map((value) => ({
    kind: "hashtag" as const,
    value,
    mentions: 1,
    platforms: ["x" as const],
  }));
  const graph = buildMindMap([topic("camry", "Camry")], [brief("camry", "campaigns", arts)]);
  const leaves = leavesOf(graph, "camry");
  assert.equal(leaves.length, 4);
  assert.ok(leaves.every((n) => n.kind !== "topic"));
  assert.ok(leaves.some((n) => n.kind === "artifact"));
  assert.ok(leaves.some((n) => n.kind === "source" && n.label === "first x"));
  assert.equal(
    leaves.some((n) => n.kind === "driver"),
    false,
  );
});
