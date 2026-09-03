import type { ForecastOutlook } from "./types";

export type OutlookClass = "fading" | "peaking" | "rising";

export const OUTLOOK_CLASSES: OutlookClass[] = ["fading", "peaking", "rising"];
export const MIN_HISTGB_SAMPLES = 16;
export const MIN_OCCUPANCY_LABELS = 20;

export interface HistGbStump {
  k: number;
  feature: number;
  threshold: number;
  left: number;
  right: number;
}

export interface HistGbModel {
  kind: "histgb";
  lr: number;
  stumps: HistGbStump[];
  samples: number;
  classes: number;
  trainedAt: string;
}

export interface HistGbExample {
  x: number[];
  y: number;
}

export interface ModelTag {
  name: "histgb" | "stump";
  samples: number;
}

const ROUNDS = 24;
const LR = 0.25;
const BINS = 16;

export function asOutlookClass(outlook: ForecastOutlook): OutlookClass | null {
  if (outlook === "rising" || outlook === "peaking" || outlook === "fading") return outlook;
  if (outlook === "stable") return "peaking";
  return null;
}

function classFromPair(prev: number, last: number): OutlookClass {
  if (last > prev * 1.08) return "rising";
  if (last < prev * 0.92) return "fading";
  return "peaking";
}

export function windowVector(
  counts: number[],
  baselineLast: number,
  baselinePrev: number,
  occupancy = 0,
  organic = 0,
): number[] {
  const last4 = counts.slice(-4);
  const last = last4.at(-1) ?? 0;
  const prev = last4.at(-2) ?? 0;
  const first = last4[0] ?? last;
  return [last, prev, last - first, baselineLast, baselinePrev, occupancy, organic, last4.length];
}

export function occupancyVector(opts: {
  officialHost: boolean;
  hasQr: boolean;
  titleLen: number;
  hostHasBrand: boolean;
}): number[] {
  return [
    opts.officialHost ? 1 : 0,
    opts.hasQr ? 1 : 0,
    Math.min(opts.titleLen / 120, 1),
    opts.hostHasBrand ? 1 : 0,
  ];
}

/** Transitions before the latest pair — train on history, predict the last window. */
export function examplesFromCounts(
  counts: number[],
  baselines: number[],
  occupancy: number,
  organic: number,
): HistGbExample[] {
  const out: HistGbExample[] = [];
  if (counts.length < 4) return out;
  for (let i = 1; i < counts.length - 2; i++) {
    const slice = counts.slice(0, i + 1);
    const y = classFromPair(counts[i], counts[i + 1]);
    if (!y) continue;
    out.push({
      x: windowVector(slice, baselines[i] ?? 0, baselines[i - 1] ?? 0, occupancy, organic),
      y: OUTLOOK_CLASSES.indexOf(y),
    });
  }
  return out;
}

function softmax(row: number[]): number[] {
  const m = Math.max(...row);
  const exps = row.map((v) => Math.exp(v - m));
  const s = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((v) => v / s);
}

function thresholdsFor(col: number[]): number[] {
  const uniq = [...new Set(col)].toSorted((a, b) => a - b);
  if (uniq.length <= 1) return [];
  if (uniq.length <= BINS) {
    const mid: number[] = [];
    for (let i = 0; i < uniq.length - 1; i++) mid.push((uniq[i] + uniq[i + 1]) / 2);
    return mid;
  }
  const out: number[] = [];
  for (let b = 1; b < BINS; b++) {
    const q = uniq[Math.floor((b / BINS) * (uniq.length - 1))];
    if (!out.length || out[out.length - 1] !== q) out.push(q);
  }
  return out;
}

function bestStump(X: number[][], residual: number[]): Omit<HistGbStump, "k"> | null {
  let best: Omit<HistGbStump, "k"> | null = null;
  let bestGain = 0;
  const nFeat = X[0]?.length ?? 0;
  for (let f = 0; f < nFeat; f++) {
    const col = X.map((row) => row[f] ?? 0);
    for (const threshold of thresholdsFor(col)) {
      let leftSum = 0;
      let leftN = 0;
      let rightSum = 0;
      let rightN = 0;
      for (let i = 0; i < X.length; i++) {
        if ((X[i][f] ?? 0) <= threshold) {
          leftSum += residual[i];
          leftN += 1;
        } else {
          rightSum += residual[i];
          rightN += 1;
        }
      }
      if (leftN < 2 || rightN < 2) continue;
      const left = leftSum / leftN;
      const right = rightSum / rightN;
      const gain = leftN * left * left + rightN * right * right;
      if (gain > bestGain) {
        bestGain = gain;
        best = { feature: f, threshold, left, right };
      }
    }
  }
  return best;
}

export function fitHistGb(examples: HistGbExample[], classes = 3): HistGbModel | null {
  if (examples.length < MIN_HISTGB_SAMPLES) return null;
  const X = examples.map((e) => e.x);
  const y = examples.map((e) => e.y);
  const n = X.length;
  const F = Array.from({ length: n }, () => Array(classes).fill(0));
  const stumps: HistGbStump[] = [];

  for (let round = 0; round < ROUNDS; round++) {
    const P = F.map((row) => softmax(row));
    for (let k = 0; k < classes; k++) {
      const residual = y.map((yi, i) => (yi === k ? 1 : 0) - (P[i][k] ?? 0));
      const split = bestStump(X, residual);
      if (!split) continue;
      stumps.push({ k, ...split });
      for (let i = 0; i < n; i++) {
        const add = (X[i][split.feature] ?? 0) <= split.threshold ? split.left : split.right;
        F[i][k] += LR * add;
      }
    }
  }

  return {
    kind: "histgb",
    lr: LR,
    stumps,
    samples: n,
    classes,
    trainedAt: new Date().toISOString(),
  };
}

export function predictHistGb(model: HistGbModel, x: number[]): number {
  const F = Array(model.classes).fill(0);
  for (const stump of model.stumps) {
    const add = (x[stump.feature] ?? 0) <= stump.threshold ? stump.left : stump.right;
    F[stump.k] += model.lr * add;
  }
  const p = softmax(F);
  let best = 0;
  for (let i = 1; i < p.length; i++) if ((p[i] ?? 0) > (p[best] ?? 0)) best = i;
  return best;
}

export function predictOutlook(model: HistGbModel, x: number[]): OutlookClass {
  return OUTLOOK_CLASSES[predictHistGb(model, x)] ?? "peaking";
}

export function parseHistGbModel(raw: unknown): HistGbModel | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as HistGbModel;
  if (m.kind !== "histgb" || !Array.isArray(m.stumps) || typeof m.samples !== "number") return null;
  if (typeof m.lr !== "number" || typeof m.classes !== "number") return null;
  return m;
}

export const MODEL_CARD = {
  nextWindow:
    "HistGB on last-4 overlap (or leaf score) transitions. Labels are the next actual count move from receipts. Abstain under 16 transitions; L2 ratio stumps otherwise. Never an invented WHY.",
  occupancy:
    "HistGB on gold inspect tags (official/occupied) when ≥20 labels. Host-class L1 otherwise. Ignore tags drop the receipt.",
  lineage: "Each receipt keeps tool + collectedAt. Handbook and Save .md print that table. RudriQ extracts; AutoLineage records the collect step.",
} as const;
