import type {
  BoosterTopicBrief,
  DeskCategory,
  ForecastOutlook,
  LeafForecast,
  MindGraph,
  MindNode,
  MindNodeKind,
  SentimentLean,
} from "./types";
import { examplesFromCounts, fitHistGb, predictOutlook, windowVector, type HistGbModel } from "./histgb";

export interface HistoryArtifact {
  kind: string;
  value: string;
  mentions: number;
}

export interface HistoryReceipt {
  url: string;
  title: string;
  platform: string;
  score: number;
  createdAt: string | null;
  sourceApi?: string;
  tool?: string;
  collectedAt?: string;
}

export interface HistoryPoint {
  at: string;
  topicId: string;
  label: string;
  velocity: "rising" | "peaking" | "fading";
  score: number;
  lean: SentimentLean;
  pos: number;
  neg: number;
  risk: number;
  n: number;
  receiptCount: number;
  firstPlatform: string | null;
  driverWeight: number | null;
  artifacts: HistoryArtifact[];
  receipts?: HistoryReceipt[];
}

const RISE = 1.08;
const FALL = 0.92;

export function outlookFromScores(prev: number, last: number, kind: MindNodeKind): ForecastOutlook {
  if (last > prev * RISE) return "rising";
  if (last < prev * FALL) return "fading";
  return kind === "topic" ? "peaking" : "stable";
}

export function confidenceOf(n: number, thinSentiment: boolean): number {
  if (n < 2) return 0;
  const base = Math.min(0.85, 0.35 + 0.15 * (n - 1));
  return thinSentiment ? Math.round(base * 0.6 * 100) / 100 : Math.round(base * 100) / 100;
}

function series(history: HistoryPoint[], pick: (p: HistoryPoint) => number): string {
  return history.map((p) => String(pick(p))).join("→");
}

function evidenceLine(history: HistoryPoint[], category: DeskCategory): string {
  const times = history.map((p) => p.at.slice(11, 16)).filter(Boolean);
  const clock = times.length ? times.join(" → ") : `${history.length} snapshots`;
  return `${history.length} snapshot${history.length === 1 ? "" : "s"} in hawkxai_${category} · ${clock}`;
}

function thinForecast(
  node: MindNode,
  category: DeskCategory,
  history: HistoryPoint[],
  lean: SentimentLean,
  analysis: string,
): LeafForecast {
  return {
    leafId: node.id,
    topicId: node.topicId ?? "",
    category,
    kind: node.kind,
    outlook: "thin",
    sentimentLean: lean,
    confidence: 0,
    analysis,
    evidence:
      history.length === 0
        ? `No collected snapshots in hawkxai_${category} yet`
        : evidenceLine(history, category),
    thin: true,
  };
}

function metricFor(node: MindNode, point: HistoryPoint): number {
  if (node.kind === "artifact") {
    const key = node.id.split(":art:").slice(1).join(":art:");
    const hit = point.artifacts.find((a) => `${a.kind}:${a.value.toLowerCase()}` === key);
    return hit?.mentions ?? 0;
  }
  if (node.kind === "driver") return point.driverWeight ?? 0;
  if (node.kind === "source") return point.firstPlatform ? 1 : 0;
  return point.score;
}

export function forecastNode(
  node: MindNode,
  history: HistoryPoint[],
  category: DeskCategory,
  brief?: BoosterTopicBrief,
  model?: HistGbModel | null,
): LeafForecast {
  const lean = brief?.sentiment.lean ?? history.at(-1)?.lean ?? "thin";
  const last = history.at(-1);

  if (node.kind === "hub") {
    return thinForecast(
      node,
      category,
      history,
      lean,
      `${history.length} collected ingest${history.length === 1 ? "" : "s"} in this plug — hub is the filter, not a print`,
    );
  }

  if (!last || history.length < 2) {
    const now = last
      ? `Now: ${last.velocity} · titles ${last.lean} · ${last.receiptCount} receipts · score ${Math.round(last.score)}`
      : "First ingest of this print in the category database";
    return thinForecast(node, category, history, lean, `${now}. Need a second collect before a next-window call.`);
  }

  const prev = history[history.length - 2];
  const lastMetric = metricFor(node, last);
  const prevMetric = metricFor(node, prev);
  let outlook = outlookFromScores(prevMetric, lastMetric, node.kind);
  let modelTag: LeafForecast["model"] = { name: "stump", samples: model?.samples ?? 0 };
  if (model && node.kind === "topic") {
    const series = history.map((p) => metricFor(node, p));
    outlook = predictOutlook(
      model,
      windowVector(series, last.receiptCount, prev.receiptCount, 0, 0),
    );
    modelTag = { name: "histgb", samples: model.samples };
  }
  const thinSentiment = lean === "thin" || last.n < 2;

  let analysis: string;
  if (node.kind === "artifact") {
    analysis = `Mentions ${series(history, (p) => metricFor(node, p))} · titles ${last.lean} (${last.pos} pos / ${last.neg} neg)`;
  } else if (node.kind === "source") {
    const platforms = history.map((p) => p.firstPlatform ?? "—").join(" → ");
    analysis = `First print ${platforms}. Recurrence is counted, not a cause.`;
  } else if (node.kind === "driver") {
    analysis = `Driver weight ${series(history, (p) => p.driverWeight ?? 0)} · still the measured bar, not a story`;
  } else {
    analysis = `Score ${series(history, (p) => Math.round(p.score))} · ${last.velocity} · titles ${last.lean} (${last.pos} pos / ${last.neg} neg / n=${last.n})`;
  }

  return {
    leafId: node.id,
    topicId: node.topicId ?? last.topicId,
    category,
    kind: node.kind,
    outlook,
    sentimentLean: lean,
    confidence: confidenceOf(history.length, thinSentiment),
    analysis,
    evidence: evidenceLine(history, category),
    thin: false,
    model: modelTag,
  };
}

export function forecastGraph(
  graph: MindGraph,
  historyByTopic: Map<string, HistoryPoint[]>,
  category: DeskCategory,
  briefs: BoosterTopicBrief[] = [],
): LeafForecast[] {
  const briefById = new Map(briefs.map((b) => [b.topicId, b]));
  const hubHistory = [...historyByTopic.values()].flat().toSorted((a, b) => a.at.localeCompare(b.at));
  const examples = [...historyByTopic.values()].flatMap((hist) => {
    const scores = hist.map((p) => p.score);
    const bases = hist.map((p) => Math.min(p.receiptCount / 20, 1));
    return examplesFromCounts(scores, bases, 0, 0);
  });
  const model = fitHistGb(examples);
  return graph.nodes.map((node) => {
    if (node.kind === "hub") return forecastNode(node, hubHistory.slice(-6), category);
    const history = node.topicId ? historyByTopic.get(node.topicId) ?? [] : [];
    const brief = node.topicId ? briefById.get(node.topicId) : undefined;
    return forecastNode(node, history, brief?.category ?? category, brief, model);
  });
}
