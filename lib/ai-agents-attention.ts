import type { AIAgentMetrics, AttentionSource } from "./ai-agents-types";

/** RoC weighs more than volume — product is the this-week view. */
export const ATTENTION_VOLUME_WEIGHT = 0.35;
export const ATTENTION_ROC_WEIGHT = 0.65;

export function rateOfChange(current: number, prior: number): number {
  if (prior <= 0) return current > 0 ? 100 : 0;
  return ((current - prior) / prior) * 100;
}

export function normalizeLog(value: number, max: number): number {
  if (max <= 0) return 0;
  return (Math.log1p(Math.max(0, value)) / Math.log1p(max)) * 100;
}

/** Clamp RoC into a scorable band (±200% → 0–100). */
export function normalizeRoc(roc: number): number {
  const clamped = Math.max(-200, Math.min(200, roc));
  return ((clamped + 200) / 400) * 100;
}

export function attentionScore(mentions: number, roc: number, maxMentions: number): number {
  const volume = normalizeLog(mentions, maxMentions);
  const rocNorm = normalizeRoc(roc);
  return Math.round(
    ATTENTION_VOLUME_WEIGHT * volume + ATTENTION_ROC_WEIGHT * rocNorm,
  );
}

export function concentrationShare(agentMentions: number, totalMentions: number): number {
  if (totalMentions <= 0) return 0;
  return agentMentions / totalMentions;
}

export function riskFromConcentration(
  concentration: number,
  platformShares: Partial<Record<AttentionSource, number>>,
): AIAgentMetrics["risk"] {
  const shares = Object.values(platformShares).filter((n) => typeof n === "number") as number[];
  const topShare = shares.length ? Math.max(...shares) / Math.max(1, shares.reduce((a, b) => a + b, 0)) : 0;
  if (concentration >= 0.28 || topShare >= 0.85) return "high";
  if (concentration >= 0.16 || topShare >= 0.7) return "medium";
  return "low";
}

export function velocityFromRoc(roc: number): AIAgentMetrics["velocity"] {
  if (roc >= 40) return "rising";
  if (roc >= 15) return "peaking";
  if (roc <= -20) return "fading";
  return "stable";
}

export function buildMetrics(input: {
  mentions: number;
  mentionsPrior: number;
  maxMentions: number;
  totalMentions: number;
  platformShares: Partial<Record<AttentionSource, number>>;
  sentiment?: AIAgentMetrics["sentiment"];
}): AIAgentMetrics {
  const roc = rateOfChange(input.mentions, input.mentionsPrior);
  const attention = attentionScore(input.mentions, roc, input.maxMentions);
  const concentration = concentrationShare(input.mentions, input.totalMentions);
  const velocity = velocityFromRoc(roc);
  const trending = roc >= 15 && attention >= 55;

  return {
    mentions: input.mentions,
    mentionsPrior: input.mentionsPrior,
    rateOfChange: Math.round(roc * 10) / 10,
    attention,
    concentration: Math.round(concentration * 1000) / 1000,
    risk: riskFromConcentration(concentration, input.platformShares),
    sentiment: input.sentiment ?? "neutral",
    velocity,
    trending,
    trend_score: attention,
    weekly_change: Math.round(roc * 10) / 10,
  };
}
