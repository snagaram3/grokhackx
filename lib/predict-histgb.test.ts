import assert from "node:assert/strict";
import { test } from "node:test";
import { examplesFromCounts, fitHistGb } from "./histgb";
import { forecastGraph, forecastNode, type HistoryPoint } from "./predict";
import type { MindGraph, MindNode } from "./types";

function point(partial: Partial<HistoryPoint> & Pick<HistoryPoint, "at" | "score">): HistoryPoint {
  return {
    topicId: "camry",
    label: "Camry",
    velocity: "rising",
    lean: "pos",
    pos: 2,
    neg: 0,
    risk: 0,
    n: 4,
    receiptCount: 8,
    firstPlatform: "public",
    driverWeight: null,
    artifacts: [],
    ...partial,
  };
}

function topicNode(): MindNode {
  return { id: "camry", kind: "topic", label: "Camry", topicId: "camry", weight: 1 };
}

test("forecastNode uses HistGB only on topic leaves and keeps artifacts on L2 stumps", () => {
  const rising = [];
  for (let start = 2; start < 20; start++) {
    const up = [start, start + 2, start + 6, start + 12, start + 20];
    rising.push(...examplesFromCounts(up, up.map((n) => n / 80), 0.3, 0.7));
  }
  const model = fitHistGb(rising);
  assert.ok(model);

  const history: HistoryPoint[] = [
    point({ at: "2026-09-01T08:00:00.000Z", score: 10, receiptCount: 4 }),
    point({ at: "2026-09-01T09:00:00.000Z", score: 14, receiptCount: 6 }),
    point({ at: "2026-09-01T10:00:00.000Z", score: 20, receiptCount: 9 }),
    point({ at: "2026-09-01T11:00:00.000Z", score: 28, receiptCount: 12 }),
  ];
  const topic = forecastNode(topicNode(), history, "markets", undefined, model);
  assert.equal(topic.thin, false);
  assert.equal(topic.model?.name, "histgb");
  assert.equal(topic.model?.samples, model.samples);
  assert.equal(topic.outlook, "rising");

  const artifact: MindNode = {
    id: "camry:art:hashtag:#camry",
    kind: "artifact",
    label: "#camry",
    topicId: "camry",
    weight: 1,
    artifactKind: "hashtag",
  };
  const artHistory = history.map((p) => ({
    ...p,
    artifacts: [{ kind: "hashtag", value: "#camry", mentions: Math.round(p.score / 4) }],
  }));
  const art = forecastNode(artifact, artHistory, "markets", undefined, model);
  assert.equal(art.thin, false);
  assert.equal(art.model?.name, "stump");
  assert.equal(art.outlook, "rising");
});

test("forecastGraph fits HistGB from topic windows and leaves the hub thin", () => {
  const scores = Array.from({ length: 19 }, (_, i) => Math.round(8 * 1.25 ** i));
  const history = scores.map((score, i) =>
    point({
      at: `2026-09-01T${String(i).padStart(2, "0")}:00:00.000Z`,
      score,
      receiptCount: score,
    }),
  );
  const graph: MindGraph = {
    hubId: "hub",
    nodes: [
      { id: "hub", kind: "hub", label: "markets", weight: 1 },
      topicNode(),
    ],
    links: [{ source: "hub", target: "camry", kind: "branch" }],
    bridges: 0,
  };
  const forecasts = forecastGraph(graph, new Map([["camry", history]]), "markets");
  const hub = forecasts.find((f) => f.kind === "hub");
  const topic = forecasts.find((f) => f.kind === "topic");
  assert.equal(hub?.thin, true);
  assert.equal(hub?.outlook, "thin");
  assert.equal(hub?.model, undefined);
  assert.equal(topic?.thin, false);
  assert.equal(topic?.model?.name, "histgb");
  assert.ok((topic?.model?.samples ?? 0) >= 16);
  assert.equal(topic?.outlook, "rising");
});
