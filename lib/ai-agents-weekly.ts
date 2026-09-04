import type {
  AIAgent,
  AIAgentAlert,
  AttentionSourceRecord,
  WeeklyRead,
  WeeklyReadClaim,
} from "./ai-agents-types";

function weekOfLabel(d = new Date()): string {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  if (day !== 1) copy.setUTCDate(copy.getUTCDate() - (day - 1));
  return copy.toISOString().slice(0, 10);
}

function sourcesFor(agentId: string, sources: AttentionSourceRecord[], limit = 4): string[] {
  return sources.filter((s) => s.agentId === agentId).slice(0, limit).map((s) => s.id);
}

export function detectAlerts(
  agents: AIAgent[],
  sources: AttentionSourceRecord[],
): AIAgentAlert[] {
  const now = new Date().toISOString();
  const alerts: AIAgentAlert[] = [];

  for (const agent of agents) {
    const src = sourcesFor(agent.id, sources);
    if (agent.metrics.rateOfChange >= 35) {
      alerts.push({
        id: `roc_spike:${agent.id}`,
        agentId: agent.id,
        agentName: agent.name,
        kind: "roc_spike",
        title: `${agent.name} attention accelerating`,
        body: `Rate of change +${agent.metrics.rateOfChange.toFixed(1)}% this week (attention ${agent.metrics.attention}). Public chatter is shifting — not a benchmark claim.`,
        rateOfChange: agent.metrics.rateOfChange,
        attention: agent.metrics.attention,
        triggeredAt: now,
        sourceIds: src,
        layer: "paid",
      });
    }
    if (agent.metrics.rateOfChange <= -25) {
      alerts.push({
        id: `roc_drop:${agent.id}`,
        agentId: agent.id,
        agentName: agent.name,
        kind: "roc_drop",
        title: `${agent.name} attention cooling`,
        body: `Rate of change ${agent.metrics.rateOfChange.toFixed(1)}% week-over-week. Trajectory shift worth watching before you lock a build target.`,
        rateOfChange: agent.metrics.rateOfChange,
        attention: agent.metrics.attention,
        triggeredAt: now,
        sourceIds: src,
        layer: "paid",
      });
    }
    if (agent.metrics.risk === "high") {
      alerts.push({
        id: `concentration:${agent.id}`,
        agentId: agent.id,
        agentName: agent.name,
        kind: "concentration",
        title: `${agent.name} concentration risk`,
        body: `Attention share ${(agent.metrics.concentration * 100).toFixed(1)}% with skewed source mix. High concentration can inflate a single-platform narrative.`,
        rateOfChange: agent.metrics.rateOfChange,
        attention: agent.metrics.attention,
        triggeredAt: now,
        sourceIds: src,
        layer: "paid",
      });
    }
  }

  return alerts.sort((a, b) => Math.abs(b.rateOfChange) - Math.abs(a.rateOfChange));
}

/** Weekly written read — claims only from dashboard metrics + source ids. */
export function generateWeeklyRead(
  agents: AIAgent[],
  sources: AttentionSourceRecord[],
): WeeklyRead {
  const sorted = [...agents].sort((a, b) => b.metrics.rateOfChange - a.metrics.rateOfChange);
  const byAttention = [...agents].sort((a, b) => b.metrics.attention - a.metrics.attention);
  const rising = sorted.filter((a) => a.metrics.rateOfChange >= 15).slice(0, 3);
  const fading = [...sorted].reverse().filter((a) => a.metrics.rateOfChange < 0).slice(0, 2);
  const leader = byAttention[0];
  const rocLeader = sorted[0];

  const claim = (
    text: string,
    agentIds: string[],
    metric: WeeklyReadClaim["metric"],
  ): WeeklyReadClaim => ({
    text,
    agentIds,
    metric,
    sourceIds: agentIds.flatMap((id) => sourcesFor(id, sources, 3)),
  });

  const sections: WeeklyRead["sections"] = [];

  if (rocLeader) {
    sections.push({
      heading: "What shifted this week",
      body: `${rocLeader.name} leads rate-of-change at ${rocLeader.metrics.rateOfChange >= 0 ? "+" : ""}${rocLeader.metrics.rateOfChange.toFixed(1)}% with attention ${rocLeader.metrics.attention}. This is public discourse velocity — not a benchmark rank.`,
      claims: [
        claim(
          `${rocLeader.name} RoC ${rocLeader.metrics.rateOfChange.toFixed(1)}% on ${rocLeader.metrics.mentions} mentions (prior ${rocLeader.metrics.mentionsPrior}).`,
          [rocLeader.id],
          "rateOfChange",
        ),
      ],
    });
  }

  if (rising.length) {
    sections.push({
      heading: "Rising attention",
      body: rising
        .map((a) => `${a.name} (+${a.metrics.rateOfChange.toFixed(1)}% RoC, attention ${a.metrics.attention})`)
        .join("; ") + ".",
      claims: rising.map((a) =>
        claim(
          `${a.name}: attention ${a.metrics.attention}, RoC +${a.metrics.rateOfChange.toFixed(1)}%.`,
          [a.id],
          "attention",
        ),
      ),
    });
  }

  if (fading.length) {
    sections.push({
      heading: "Cooling trajectories",
      body: fading
        .map((a) => `${a.name} (${a.metrics.rateOfChange.toFixed(1)}% RoC)`)
        .join("; ") + ". Cooling attention is a planning signal, not a quality judgment.",
      claims: fading.map((a) =>
        claim(
          `${a.name}: RoC ${a.metrics.rateOfChange.toFixed(1)}% from ${a.metrics.mentionsPrior} → ${a.metrics.mentions} mentions.`,
          [a.id],
          "rateOfChange",
        ),
      ),
    });
  }

  if (leader) {
    sections.push({
      heading: "Why it matters for build targets",
      body: `${leader.name} holds the highest attention score (${leader.metrics.attention}) with concentration ${(leader.metrics.concentration * 100).toFixed(1)}% (risk ${leader.metrics.risk}). Engineering leaders should weight this week's RoC against concentration risk before locking a stack — independent of vendor marketing.`,
      claims: [
        claim(
          `${leader.name} attention ${leader.metrics.attention}; concentration ${(leader.metrics.concentration * 100).toFixed(1)}%; risk ${leader.metrics.risk}.`,
          [leader.id],
          "concentration",
        ),
      ],
    });
  }

  const allClaims = sections.flatMap((s) => s.claims);
  const sourceCount = new Set(allClaims.flatMap((c) => c.sourceIds)).size;

  return {
    id: `weekly:${weekOfLabel()}`,
    weekOf: weekOfLabel(),
    title: "This week's agent attention",
    summary:
      "Independent public-signal read for engineering leaders choosing a build target. Metrics are attention (volume + rate of change) from discourse receipts — never download or usage claims. Every claim below cites the same receipts the dashboard shows.",
    sections,
    generatedAt: new Date().toISOString(),
    layer: "paid",
    sourceCount,
  };
}
