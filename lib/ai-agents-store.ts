import { buildMetrics } from "./ai-agents-attention";
import { ingestAllAgents } from "./ai-agents-ingest";
import {
  SEED_AGENTS,
  buildSeedSources,
  buildSeedTrendSeries,
  platformSharesForWindow,
  windowMentions,
  withCategories,
} from "./ai-agents-seed";
import { detectAlerts, generateWeeklyRead } from "./ai-agents-weekly";
import type {
  AIAgent,
  AIAgentAlert,
  AIAgentFilter,
  AIAgentInsight,
  AIAgentSort,
  AIAgentsPayload,
  AIAgentTrendPoint,
  AttentionSourceRecord,
  ProductLayer,
  WeeklyRead,
} from "./ai-agents-types";

function sortAgents(agents: AIAgent[], sort: AIAgentSort = "rateOfChange"): AIAgent[] {
  const copy = [...agents];
  switch (sort) {
    case "mentions":
      return copy.sort((a, b) => b.metrics.mentions - a.metrics.mentions);
    case "attention":
      return copy.sort((a, b) => b.metrics.attention - a.metrics.attention);
    case "concentration":
      return copy.sort((a, b) => b.metrics.concentration - a.metrics.concentration);
    case "rateOfChange":
    default:
      return copy.sort((a, b) => b.metrics.rateOfChange - a.metrics.rateOfChange);
  }
}

export class AIAgentsStore {
  private agents: Map<string, AIAgent> = new Map();
  private trends: Map<string, AIAgentTrendPoint[]> = new Map();
  private sources: Map<string, AttentionSourceRecord[]> = new Map();
  private lastUpdate: string = new Date().toISOString();
  private dataMode: AIAgentsPayload["dataMode"] = "seeded";

  constructor() {
    this.initializeSeedData();
  }

  private initializeSeedData() {
    const now = new Date().toISOString();
    const seriesByAgent = new Map<string, AIAgentTrendPoint[]>();
    const mentionWindows: { id: string; current: number; prior: number; shares: ReturnType<typeof platformSharesForWindow> }[] = [];

    for (const seed of SEED_AGENTS) {
      const series = buildSeedTrendSeries(seed.id);
      seriesByAgent.set(seed.id, series);
      this.trends.set(seed.id, series);
      this.sources.set(seed.id, buildSeedSources(seed, series));
      mentionWindows.push({
        id: seed.id,
        current: windowMentions(series, 0, 6),
        prior: windowMentions(series, 7, 13),
        shares: platformSharesForWindow(series, 0, 6),
      });
    }

    const maxMentions = Math.max(...mentionWindows.map((w) => w.current), 1);
    const totalMentions = mentionWindows.reduce((s, w) => s + w.current, 0);

    for (const seed of SEED_AGENTS) {
      const window = mentionWindows.find((w) => w.id === seed.id)!;
      const base = withCategories(seed);
      const metrics = buildMetrics({
        mentions: window.current,
        mentionsPrior: window.prior,
        maxMentions,
        totalMentions,
        platformShares: window.shares,
        sentiment: seed.capabilities[0]?.score >= 95 ? "positive" : "mixed",
      });
      this.agents.set(seed.id, {
        ...base,
        metrics,
        lastUpdated: now,
      });
    }

    this.lastUpdate = now;
    this.dataMode = "seeded";
  }

  private recomputeFromSeries() {
    const now = new Date().toISOString();
    const windows = Array.from(this.agents.keys()).map((id) => {
      const series = this.trends.get(id) || [];
      return {
        id,
        current: windowMentions(series, 0, 6),
        prior: windowMentions(series, 7, 13),
        shares: platformSharesForWindow(series, 0, 6),
      };
    });
    const maxMentions = Math.max(...windows.map((w) => w.current), 1);
    const totalMentions = windows.reduce((s, w) => s + w.current, 0);

    for (const w of windows) {
      const agent = this.agents.get(w.id);
      if (!agent) continue;
      agent.metrics = buildMetrics({
        mentions: w.current,
        mentionsPrior: w.prior,
        maxMentions,
        totalMentions,
        platformShares: w.shares,
        sentiment: agent.metrics.sentiment,
      });
      agent.lastUpdated = now;
    }
    this.lastUpdate = now;
  }

  /** Merge live receipts into store; bump latest day mentions when live hits arrive. */
  async refreshLive(): Promise<void> {
    try {
      const { records, liveAgentIds } = await ingestAllAgents(SEED_AGENTS, {
        limitPerSource: 6,
        timeoutMs: 4000,
      });
      if (!records.length) return;

      const today = new Date().toISOString().slice(0, 10);
      for (const agentId of liveAgentIds) {
        const live = records.filter((r) => r.agentId === agentId);
        const existing = this.sources.get(agentId) || [];
        const merged = [...live, ...existing];
        const seen = new Set<string>();
        this.sources.set(
          agentId,
          merged.filter((r) => {
            if (seen.has(r.id)) return false;
            seen.add(r.id);
            return true;
          }).slice(0, 40),
        );

        const series = this.trends.get(agentId) || buildSeedTrendSeries(agentId);
        const point = series.find((p) => p.date === today) || {
          agentId,
          date: today,
          mentions: 0,
          platforms: {},
        };
        const bump = Math.max(live.length * 3, 1);
        point.mentions += bump;
        for (const r of live) {
          point.platforms[r.platform] = (point.platforms[r.platform] || 0) + 1;
        }
        const nextSeries = series.filter((p) => p.date !== today).concat(point).sort((a, b) => a.date.localeCompare(b.date));
        this.trends.set(agentId, nextSeries);
      }

      this.recomputeFromSeries();
      this.dataMode = liveAgentIds.length === SEED_AGENTS.length ? "live" : "mixed";
    } catch (err) {
      console.error("[ai-agents] live refresh failed, keeping seeded fallback", err);
      // Seeded data already present — never empty.
    }
  }

  getAll(filter?: AIAgentFilter): AIAgent[] {
    let agents = Array.from(this.agents.values());

    if (filter?.category) {
      agents = agents.filter(
        (a) => a.category === filter.category || a.categories.includes(filter.category!),
      );
    }
    if (filter?.provider) {
      agents = agents.filter((a) => a.provider === filter.provider);
    }
    if (filter?.trending !== undefined) {
      agents = agents.filter((a) => a.metrics.trending === filter.trending);
    }
    if (filter?.minMentions !== undefined) {
      agents = agents.filter((a) => a.metrics.mentions >= filter.minMentions!);
    }
    if (filter?.minRateOfChange !== undefined) {
      agents = agents.filter((a) => a.metrics.rateOfChange >= filter.minRateOfChange!);
    }
    if (filter?.pricingTier) {
      agents = agents.filter((a) => a.pricing.tier === filter.pricingTier);
    }

    return sortAgents(agents, filter?.sort ?? "rateOfChange");
  }

  getById(id: string): AIAgent | undefined {
    return this.agents.get(id);
  }

  getSources(agentId?: string): AttentionSourceRecord[] {
    if (agentId) return this.sources.get(agentId) || [];
    return Array.from(this.sources.values()).flat();
  }

  getTrends(agentId?: string): AIAgentTrendPoint[] {
    if (agentId) return this.trends.get(agentId) || [];
    return Array.from(this.trends.values()).flat();
  }

  getAlerts(): AIAgentAlert[] {
    return detectAlerts(Array.from(this.agents.values()), this.getSources());
  }

  getWeeklyRead(): WeeklyRead {
    return generateWeeklyRead(Array.from(this.agents.values()), this.getSources());
  }

  getPayload(filter?: AIAgentFilter, layer: ProductLayer = "free"): AIAgentsPayload {
    const agents = this.getAll(filter);
    const allSources = this.getSources();
    const agentIds = new Set(agents.map((a) => a.id));
    const sources = allSources.filter((s) => agentIds.has(s.agentId));
    const trends = agents.flatMap((a) => this.getTrends(a.id));

    const byCategory: Record<string, number> = {};
    const byProvider: Record<string, number> = {};
    for (const agent of agents) {
      byCategory[agent.category] = (byCategory[agent.category] || 0) + 1;
      byProvider[agent.provider] = (byProvider[agent.provider] || 0) + 1;
    }

    const payload: AIAgentsPayload = {
      agents,
      trends,
      sources: layer === "paid" ? sources : sources.slice(0, 24),
      alerts: layer === "paid" ? this.getAlerts() : [],
      weekly: layer === "paid" ? this.getWeeklyRead() : undefined,
      updatedAt: this.lastUpdate,
      dataMode: this.dataMode,
      layer,
      metadata: {
        total: agents.length,
        byCategory,
        byProvider,
        trending: agents.filter((a) => a.metrics.trending).length,
        risingFast: agents.filter((a) => a.metrics.rateOfChange >= 15).length,
        totalMentions: agents.reduce((s, a) => s + a.metrics.mentions, 0),
        windowLabel: "this week vs prior week",
      },
    };
    return payload;
  }

  generateInsights(agents: AIAgent[]): AIAgentInsight[] {
    const insights: AIAgentInsight[] = [];
    const sources = this.getSources();

    const capabilityScores = new Map<string, { agent: string; id: string; score: number }[]>();
    for (const agent of agents) {
      for (const cap of agent.capabilities) {
        const scores = capabilityScores.get(cap.name) || [];
        scores.push({ agent: agent.name, id: agent.id, score: cap.score });
        capabilityScores.set(cap.name, scores);
      }
    }

    for (const [capability, scores] of capabilityScores) {
      const sorted = scores.sort((a, b) => b.score - a.score);
      if (sorted.length > 0 && sorted[0].score >= 95) {
        insights.push({
          type: "capability",
          title: `${capability} Leadership`,
          description: `${sorted[0].agent} leads in ${capability} with a score of ${sorted[0].score}/100`,
          agents: [sorted[0].agent],
          confidence: sorted[0].score / 100,
          evidence: [`Highest capability score: ${sorted[0].score}/100`],
          sourceIds: sources.filter((s) => s.agentId === sorted[0].id).slice(0, 2).map((s) => s.id),
        });
      }
    }

    const rising = agents.filter((a) => a.metrics.velocity === "rising" && a.metrics.rateOfChange > 15);
    if (rising.length > 0) {
      insights.push({
        type: "attention",
        title: "Rising attention",
        description: `${rising.length} agents with accelerating public attention this week (discourse signal only).`,
        agents: rising.map((a) => a.name),
        confidence: 0.85,
        evidence: rising.map((a) => `${a.name}: RoC +${a.metrics.rateOfChange.toFixed(1)}% · attention ${a.metrics.attention}`),
        sourceIds: rising.flatMap((a) => sources.filter((s) => s.agentId === a.id).slice(0, 2).map((s) => s.id)),
      });
    }

    const recentReleases = agents.filter((a) => {
      const latestRelease = a.releases[0];
      if (!latestRelease) return false;
      const releaseDate = new Date(latestRelease.date);
      const monthsAgo = (Date.now() - releaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      return monthsAgo < 3;
    });
    if (recentReleases.length > 0) {
      insights.push({
        type: "innovation",
        title: "Recent release chatter",
        description: `${recentReleases.length} agents with major releases in the last 3 months — attention often follows ship dates.`,
        agents: recentReleases.map((a) => a.name),
        confidence: 0.95,
        evidence: recentReleases.map((a) => `${a.name}: ${a.releases[0].version}`),
        sourceIds: recentReleases.flatMap((a) =>
          sources.filter((s) => s.agentId === a.id && s.platform === "changelog").slice(0, 1).map((s) => s.id),
        ),
      });
    }

    return insights;
  }

  /** Soft refresh: recompute from seeded series (always succeeds). */
  refresh() {
    this.initializeSeedData();
  }
}

let storeInstance: AIAgentsStore | null = null;

export function getAIAgentsStore(): AIAgentsStore {
  if (!storeInstance) {
    storeInstance = new AIAgentsStore();
  }
  return storeInstance;
}

/** Test helper */
export function resetAIAgentsStore(): void {
  storeInstance = null;
}
