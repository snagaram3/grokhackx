"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AmbientBackground from "@/components/AmbientBackground";
import {
  DeskFrame,
  DeskNav,
  GhostButton,
  HomeMark,
  PrimaryButton,
  StatusChip,
} from "@/components/shell/DeskChrome";
import DeskWorkspace from "@/components/shell/DeskWorkspace";
import type {
  AIAgent,
  AIAgentCategory,
  AIAgentInsight,
  AIAgentProvider,
  AIAgentsPayload,
} from "@/lib/ai-agents-types";
import { AI_AGENT_CATEGORIES, AI_AGENT_PROVIDERS } from "@/lib/ai-agents-types";

function AIAgentsList({
  agents,
  selected,
  onSelect,
}: {
  agents: AIAgent[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  if (agents.length === 0) {
    return (
      <div className="empty-stage">
        <div className="empty-stage__body">
          <p className="empty-stage__eyebrow">No agents</p>
          <h1 className="empty-stage__title">No AI agents match your filters</h1>
          <p className="empty-stage__copy">Try adjusting your filters or refresh the data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="empty-stage">
      <div className="empty-stage__head">
        <div>
          <p className="empty-stage__eyebrow">AI Agents</p>
          <h2 className="text-lg font-medium">{agents.length} agents tracked</h2>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-auto p-3">
        <div className="flex flex-col gap-2">
          {agents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              onClick={() => onSelect(agent.id)}
              className={`flex flex-col gap-2 rounded-lg border p-3 text-left transition-all ${
                selected === agent.id
                  ? "border-[var(--amber)] bg-[var(--amber-soft)]"
                  : "border-[var(--line)] bg-[var(--panel)] hover:border-[var(--line-strong)] hover:bg-[var(--panel)]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-medium text-[var(--ink)]">{agent.name}</h3>
                  <p className="signal-label mt-1">
                    {agent.provider} · {agent.category}
                  </p>
                </div>
                {agent.metrics.trending && (
                  <span className="shrink-0 rounded-full bg-[var(--up)] px-2 py-0.5 text-[10px] font-medium text-black">
                    TRENDING
                  </span>
                )}
              </div>
              <p className="line-clamp-2 text-sm text-[var(--mute-strong)]">{agent.description}</p>
              <div className="flex items-center gap-3 text-xs">
                <span className="signal-label">
                  {agent.metrics.mentions.toLocaleString()} mentions
                </span>
                <span className={`signal-label ${agent.metrics.weekly_change >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>
                  {agent.metrics.weekly_change >= 0 ? "+" : ""}
                  {agent.metrics.weekly_change.toFixed(1)}% weekly
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AIAgentDetail({ agent }: { agent: AIAgent | null }) {
  if (!agent) {
    return (
      <div className="empty-stage">
        <div className="empty-stage__body">
          <p className="empty-stage__eyebrow">Select an agent</p>
          <h1 className="empty-stage__title">View detailed insights</h1>
          <p className="empty-stage__copy">Choose an AI agent from the list to see its capabilities, metrics, and trends</p>
        </div>
      </div>
    );
  }

  return (
    <div className="empty-stage">
      <div className="empty-stage__head">
        <div>
          <p className="empty-stage__eyebrow">{agent.provider}</p>
          <h2 className="text-xl font-medium text-white">{agent.name}</h2>
          <p className="mt-2 text-sm text-[var(--mute-strong)]">{agent.description}</p>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-4">
        {/* Metrics */}
        <section>
          <h3 className="signal-label mb-3">Metrics</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="signal-label">Mentions</p>
              <p className="mt-2 text-2xl font-medium tabular text-[var(--ink)]">
                {agent.metrics.mentions.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="signal-label">Velocity</p>
              <p className="mt-2 text-sm font-medium uppercase text-[var(--ink)]">
                {agent.metrics.velocity}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="signal-label">Sentiment</p>
              <p className="mt-2 text-sm font-medium uppercase text-[var(--ink)]">
                {agent.metrics.sentiment}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="signal-label">Weekly Change</p>
              <p className={`mt-2 text-2xl font-medium tabular ${agent.metrics.weekly_change >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>
                {agent.metrics.weekly_change >= 0 ? "+" : ""}
                {agent.metrics.weekly_change.toFixed(1)}%
              </p>
            </div>
          </div>
        </section>

        {/* Capabilities */}
        <section>
          <h3 className="signal-label mb-3">Capabilities</h3>
          <div className="flex flex-col gap-2">
            {agent.capabilities.map((cap, i) => (
              <div key={i} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-[var(--ink)]">{cap.name}</h4>
                    <p className="mt-1 text-sm text-[var(--mute-strong)]">{cap.description}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-2xl font-medium tabular text-[var(--ink)]">{cap.score}</p>
                    <p className="signal-label">/ 100</p>
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--line)]">
                  <div
                    className="h-full bg-[var(--amber)] transition-all"
                    style={{ width: `${cap.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section>
          <h3 className="signal-label mb-3">Pricing</h3>
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="mb-2 text-sm font-medium uppercase text-[var(--ink)]">{agent.pricing.tier}</p>
            {agent.pricing.inputCost !== undefined && (
              <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="signal-label">Input</p>
                  <p className="mt-1 text-[var(--ink)]">
                    ${agent.pricing.inputCost} / 1M tokens
                  </p>
                </div>
                <div>
                  <p className="signal-label">Output</p>
                  <p className="mt-1 text-[var(--ink)]">
                    ${agent.pricing.outputCost} / 1M tokens
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Recent Releases */}
        {agent.releases.length > 0 && (
          <section>
            <h3 className="signal-label mb-3">Recent Releases</h3>
            <div className="flex flex-col gap-2">
              {agent.releases.slice(0, 3).map((release, i) => (
                <div key={i} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
                  <div className="flex items-baseline gap-2">
                    <h4 className="font-medium text-[var(--ink)]">{release.version}</h4>
                    <p className="signal-label">{new Date(release.date).toLocaleDateString()}</p>
                  </div>
                  <ul className="mt-2 flex flex-col gap-1">
                    {release.features.map((feature, j) => (
                      <li key={j} className="text-sm text-[var(--mute-strong)]">
                        • {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Links */}
        <section>
          <h3 className="signal-label mb-3">Links</h3>
          <div className="flex flex-wrap gap-2">
            {agent.officialUrl && (
              <a
                href={agent.officialUrl}
                target="_blank"
                rel="noreferrer"
                className="empty-stage__chip"
              >
                Official Site
              </a>
            )}
            {agent.docsUrl && (
              <a
                href={agent.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="empty-stage__chip"
              >
                Documentation
              </a>
            )}
            {agent.githubUrl && (
              <a
                href={agent.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="empty-stage__chip"
              >
                GitHub
              </a>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function AIAgentsOverview({
  payload,
  insights,
}: {
  payload: AIAgentsPayload | null;
  insights: AIAgentInsight[];
}) {
  if (!payload) {
    return (
      <div className="empty-stage">
        <div className="empty-stage__body">
          <p className="empty-stage__eyebrow">AI Agents Intelligence</p>
          <h1 className="empty-stage__title">Track the AI Agent Ecosystem</h1>
          <p className="empty-stage__copy">
            Monitor trends, capabilities, and adoption metrics across leading AI agents
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="empty-stage">
      <div className="empty-stage__head">
        <div>
          <p className="empty-stage__eyebrow">Overview</p>
          <h2 className="text-lg font-medium">AI Agents Landscape</h2>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-4">
        {/* Summary Stats */}
        <section>
          <h3 className="signal-label mb-3">Summary</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="signal-label">Total Agents</p>
              <p className="mt-2 text-3xl font-medium tabular text-[var(--ink)]">
                {payload.metadata.total}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="signal-label">Trending</p>
              <p className="mt-2 text-3xl font-medium tabular text-[var(--up)]">
                {payload.metadata.trending}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="signal-label">Categories</p>
              <p className="mt-2 text-3xl font-medium tabular text-[var(--ink)]">
                {Object.keys(payload.metadata.byCategory).length}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="signal-label">Providers</p>
              <p className="mt-2 text-3xl font-medium tabular text-[var(--ink)]">
                {Object.keys(payload.metadata.byProvider).length}
              </p>
            </div>
          </div>
        </section>

        {/* Insights */}
        {insights.length > 0 && (
          <section>
            <h3 className="signal-label mb-3">Key Insights</h3>
            <div className="flex flex-col gap-3">
              {insights.map((insight, i) => (
                <div key={i} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-[var(--ink)]">{insight.title}</h4>
                      <p className="mt-2 text-sm text-[var(--mute-strong)]">{insight.description}</p>
                      {insight.evidence.length > 0 && (
                        <ul className="mt-3 flex flex-col gap-1">
                          {insight.evidence.slice(0, 3).map((evidence, j) => (
                            <li key={j} className="signal-label">
                              • {evidence}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <span className="shrink-0 rounded border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-xs font-medium uppercase text-[var(--mute)]">
                      {insight.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* By Category */}
        <section>
          <h3 className="signal-label mb-3">By Category</h3>
          <div className="flex flex-col gap-2">
            {Object.entries(payload.metadata.byCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([category, count]) => (
                <div
                  key={category}
                  className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3"
                >
                  <span className="text-sm font-medium text-[var(--ink)]">{category}</span>
                  <span className="signal-label">{count} agents</span>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function AIAgentsDesk() {
  const [payload, setPayload] = useState<AIAgentsPayload | null>(null);
  const [insights, setInsights] = useState<AIAgentInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<AIAgentCategory | "">("");
  const [providerFilter, setProviderFilter] = useState<AIAgentProvider | "">("");
  const [trendingOnly, setTrendingOnly] = useState(false);
  const booted = useRef(false);

  const fetchAgents = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set("category", categoryFilter);
      if (providerFilter) params.set("provider", providerFilter);
      if (trendingOnly) params.set("trending", "true");
      if (refresh) params.set("refresh", "true");

      const res = await fetch(`/api/ai-agents?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
      
      const data = await res.json();
      setPayload(data);
      setInsights(data.insights || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch AI agents");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, providerFilter, trendingOnly]);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    if (booted.current) {
      void fetchAgents();
    }
  }, [categoryFilter, providerFilter, trendingOnly, fetchAgents]);

  const selectedAgent = payload?.agents.find((a) => a.id === selectedAgentId) || null;

  return (
    <main className="desk-shell">
      <AmbientBackground />

      <DeskFrame
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as AIAgentCategory | "")}
              className="field-select__control"
            >
              <option value="">All Categories</option>
              {AI_AGENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value as AIAgentProvider | "")}
              className="field-select__control"
            >
              <option value="">All Providers</option>
              {AI_AGENT_PROVIDERS.map((prov) => (
                <option key={prov} value={prov}>
                  {prov}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setTrendingOnly(!trendingOnly)}
              className={`btn-ghost ${trendingOnly ? "bg-[var(--amber-soft)] text-[var(--amber)]" : ""}`}
            >
              {trendingOnly ? "✓ " : ""}Trending
            </button>
          </div>
        }
        context={
          <>
            <span className="signal-label shrink-0">AI Agents Intelligence</span>
            {payload && (
              <>
                <StatusChip>{payload.metadata.total} agents</StatusChip>
                <StatusChip>{payload.metadata.trending} trending</StatusChip>
              </>
            )}
            <GhostButton onClick={() => void fetchAgents(true)} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </GhostButton>
          </>
        }
      >
        <div className="desk-chrome__brand flex min-w-0 shrink-0 items-center gap-3">
          <HomeMark />
          <DeskNav active="ai-agents" />
        </div>
      </DeskFrame>

      {error && (
        <div role="alert" className="relative z-20 mx-3 mt-2 rounded-[var(--radius-md)] border border-white/8 bg-[var(--panel-strong)] px-4 py-2.5">
          <p className="signal-label">{error}</p>
        </div>
      )}

      <DeskWorkspace
        listLabel="Agents"
        listBlurb={payload ? `${payload.agents.length} tracked` : "Loading..."}
        stageLabel="Overview"
        stageBlurb="Insights"
        detailLabel="Detail"
        detailBlurb="Deep dive"
        preferStage={!selectedAgentId}
        stageKey={selectedAgentId}
        list={
          <AIAgentsList
            agents={payload?.agents || []}
            selected={selectedAgentId}
            onSelect={setSelectedAgentId}
          />
        }
        stage={<AIAgentsOverview payload={payload} insights={insights} />}
        detail={<AIAgentDetail agent={selectedAgent} />}
      />
    </main>
  );
}
