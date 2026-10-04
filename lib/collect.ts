import { classifyTopic } from "./desk";
import { buildMindMap } from "./mindmap";
import { forecastGraph, type HistoryPoint } from "./predict";
import { collectTape, historyForTopics, trendStore } from "./trend-store";
import type {
  BoosterPayload,
  BoosterTopicBrief,
  CollectionStatus,
  DeskCategory,
  LeafForecast,
  MindGraph,
  TrendsPayload,
} from "./types";

const COLLECT_MS = 2500;

function withTimeout<T>(job: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("collect timeout")), ms);
    job.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export async function collectAndForecast(
  payload: TrendsPayload,
  briefs: BoosterTopicBrief[] = [],
  category: DeskCategory = "all",
): Promise<{ forecasts: LeafForecast[]; collection: CollectionStatus; graph: MindGraph }> {
  const store = trendStore();
  const graph = buildMindMap(
    payload.topics,
    briefs,
    category,
    payload.plugged
      ? { label: payload.plugged.slice(0, 42), detail: `${payload.topics.length} related prints` }
      : undefined,
  );

  let snapshotId = `${payload.updatedAt}|${payload.plugged ?? "tape"}`;
  try {
    const collected = await withTimeout(collectTape(payload, briefs), COLLECT_MS);
    snapshotId = collected.snapshotId;
  } catch (err) {
    console.warn("[collect]", err instanceof Error ? err.message : err);
  }

  const topicIds = [...new Set(graph.nodes.flatMap((n) => (n.topicId ? [n.topicId] : [])))];
  let history = new Map<string, HistoryPoint[]>();
  try {
    history = await withTimeout(historyForTopics(store, "all", topicIds), COLLECT_MS);
  } catch (err) {
    console.warn("[collect] history", err instanceof Error ? err.message : err);
  }

  const forecasts = forecastGraph(graph, history, category, briefs);
  try {
    await withTimeout(store.savePredictions(category, snapshotId, forecasts), COLLECT_MS);
  } catch (err) {
    console.warn("[collect] predict", err instanceof Error ? err.message : err);
  }

  const snapshots = await store.snapshotCount().catch(() => 0);
  const leadId = payload.topics[0]?.id;
  const leadHistory = leadId ? history.get(leadId) ?? [] : [];
  return {
    forecasts,
    graph,
    collection: {
      backend: store.backend,
      databases: store.databases,
      snapshots,
      predicted: forecasts.filter((f) => !f.thin).length,
      history: leadHistory.map((p) => ({
        at: p.at,
        score: p.score,
        receipts: p.receiptCount,
      })),
    },
  };
}

export function categoryForTape(payload: TrendsPayload, briefs: BoosterTopicBrief[]): DeskCategory {
  if (payload.query?.category) return payload.query.category;
  const lead = payload.topics[0];
  if (!lead) return "all";
  const brief = briefs.find((b) => b.topicId === lead.id);
  return brief?.category ?? classifyTopic(lead, brief?.artifacts ?? []);
}

export function collectionCategory(
  payload: TrendsPayload,
  briefs: BoosterTopicBrief[],
): DeskCategory {
  return payload.plugged ? categoryForTape(payload, briefs) : "all";
}

export async function attachCollection(
  payload: TrendsPayload,
  booster: BoosterPayload,
): Promise<BoosterPayload> {
  const category = collectionCategory(payload, booster.briefs);
  const { forecasts, collection } = await collectAndForecast(payload, booster.briefs, category);
  return { ...booster, forecasts, collection };
}
