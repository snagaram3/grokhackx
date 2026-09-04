"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AmbientBackground from "@/components/AmbientBackground";
import {
  DeskFrame,
  DeskNav,
  GhostButton,
  HomeMark,
  StatusChip,
  type DeskId,
} from "@/components/shell/DeskChrome";
import DeskWorkspace from "@/components/shell/DeskWorkspace";
import type {
  AIAgent,
  AIAgentCategory,
  AIAgentInsight,
  AIAgentProvider,
  AIAgentSort,
  AIAgentsPayload,
  AttentionSourceRecord,
  DeskMode,
  ProductLayer,
} from "@/lib/ai-agents-types";
import { AI_AGENT_CATEGORIES, AI_AGENT_PROVIDERS } from "@/lib/ai-agents-types";
import AIAgentsCompare from "./AIAgentsCompare";
import AlertsPanel from "./AlertsPanel";
import CostCalculator from "./CostCalculator";
import SourceLinks from "./SourceLinks";
import WeeklyReadPanel from "./WeeklyReadPanel";

const MODE_TO_DESK: Record<DeskMode, DeskId> = {
  trends: "trends",
  compare: "watchlist",
  calculator: "footprint",
  weekly: "insights",
  alerts: "research",
};

function sparkPoints(values: number[]): string {
  if (!values.length) return "";
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  return values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * 40;
      const y = 16 - ((v - min) / span) * 14;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function AIAgentsList({
  agents,
  selected,
  onSelect,
  compareMode,
  selectedForCompare,
  onToggleCompare,
  trendsByAgent,
}: {
  agents: AIAgent[];
  selected: string | null;
  onSelect: (id: string) => void;
  compareMode: boolean;
  selectedForCompare: Set<string>;
  onToggleCompare: (id: string) => void;
  trendsByAgent: Map<string, number[]>;
}) {
  if (agents.length === 0) {
    return (
      <div className="empty-stage">
        <div className="empty-stage__body">
          <p className="empty-stage__eyebrow">No matches</p>
          <h1 className="empty-stage__title">No agents match these filters</h1>
          <p className="empty-stage__copy">Clear filters or lower the RoC threshold — seeded fallback always has data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="empty-stage">
      <div className="empty-stage__head">
        <div>
          <p className="empty-stage__eyebrow">Attention board</p>
          <h2 className="text-lg font-medium">{agents.length} agents · sorted by signal</h2>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-auto p-3">
        <div className="flex flex-col gap-2">
          {agents.map((agent) => {
            const series = trendsByAgent.get(agent.id) || [];
            return (
              <div
                key={agent.id}
                className={`flex gap-3 rounded-lg border p-3 transition-colors duration-75 ${
                  selected === agent.id
                    ? "border-[var(--amber)] bg-[var(--amber-soft)]"
                    : "border-[var(--line)] bg-[var(--panel)]"
                }`}
              >
                {compareMode && (
                  <input
                    type="checkbox"
                    checked={selectedForCompare.has(agent.id)}
                    onChange={() => onToggleCompare(agent.id)}
                    className="mt-1 shrink-0"
                    aria-label={`Compare ${agent.name}`}
                  />
                )}
                <button
                  type="button"
                  onClick={() => !compareMode && onSelect(agent.id)}
                  className="flex min-w-0 flex-1 flex-col gap-2 text-left"
                  disabled={compareMode}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-medium text-[var(--ink)]">{agent.name}</h3>
                      <p className="signal-label mt-1">
                        {agent.provider} · {agent.category}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {agent.metrics.trending && (
                        <span className="rounded bg-[var(--up)] px-1.5 py-0.5 text-[10px] font-medium text-black">
                          RISING
                        </span>
                      )}
                      <span className="signal-label tabular-nums">att {agent.metrics.attention}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums">
                      <span className="signal-label">{agent.metrics.mentions.toLocaleString()} mentions</span>
                      <span
                        className={
                          agent.metrics.rateOfChange >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"
                        }
                      >
                        RoC {agent.metrics.rateOfChange >= 0 ? "+" : ""}
                        {agent.metrics.rateOfChange.toFixed(1)}%
                      </span>
                      <span className="signal-label">risk {agent.metrics.risk}</span>
                    </div>
                    {series.length > 1 && (
                      <svg width="44" height="18" viewBox="0 0 44 18" aria-hidden className="shrink-0 opacity-70">
                        <polyline
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          points={sparkPoints(series)}
                        />
                      </svg>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AIAgentDetail({
  agent,
  sources,
}: {
  agent: AIAgent | null;
  sources: AttentionSourceRecord[];
}) {
  if (!agent) {
    return (
      <div className="empty-stage">
        <div className="empty-stage__body">
          <p className="empty-stage__eyebrow">Select an agent</p>
          <h1 className="empty-stage__title">Trace every number</h1>
          <p className="empty-stage__copy">
            Pick an agent to see attention, rate-of-change, concentration risk, and the receipts behind them.
          </p>
        </div>
      </div>
    );
  }

  const agentSources = sources.filter((s) => s.agentId === agent.id);

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
        <section>
          <h3 className="signal-label mb-3">Attention metrics</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="signal-label">Attention</p>
              <p className="mt-2 text-2xl font-medium tabular-nums text-[var(--ink)]">
                {agent.metrics.attention}
              </p>
              <SourceLinks sources={agentSources.slice(0, 3)} label="Linked receipts" />
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="signal-label">Rate of change</p>
              <p
                className={`mt-2 text-2xl font-medium tabular-nums ${
                  agent.metrics.rateOfChange >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"
                }`}
              >
                {agent.metrics.rateOfChange >= 0 ? "+" : ""}
                {agent.metrics.rateOfChange.toFixed(1)}%
              </p>
              <p className="mt-1 signal-label tabular-nums">
                {agent.metrics.mentionsPrior} → {agent.metrics.mentions}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="signal-label">Mentions</p>
              <p className="mt-2 text-2xl font-medium tabular-nums text-[var(--ink)]">
                {agent.metrics.mentions.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="signal-label">Velocity</p>
              <p className="mt-2 text-sm font-medium uppercase text-[var(--ink)]">{agent.metrics.velocity}</p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="signal-label">Concentration</p>
              <p className="mt-2 text-2xl font-medium tabular-nums text-[var(--ink)]">
                {(agent.metrics.concentration * 100).toFixed(1)}%
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="signal-label">Risk</p>
              <p className="mt-2 text-sm font-medium uppercase text-[var(--ink)]">{agent.metrics.risk}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-[var(--mute)]">
            Attention = public discourse volume + rate of change. Not adoption. Not benchmarks.
          </p>
        </section>

        <section>
          <h3 className="signal-label mb-3">All source receipts</h3>
          <SourceLinks sources={agentSources} empty="No receipts yet — seeded fallback should always populate." />
        </section>

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
                  <p className="shrink-0 text-2xl font-medium tabular-nums text-[var(--ink)]">{cap.score}</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded bg-[var(--line)]">
                  <div className="h-full bg-[var(--amber)]" style={{ width: `${cap.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="signal-label mb-3">Pricing (assumptions for calculator)</h3>
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="mb-2 text-sm font-medium uppercase text-[var(--ink)]">{agent.pricing.tier}</p>
            {agent.pricing.inputCost !== undefined ? (
              <div className="mt-2 grid grid-cols-2 gap-4 text-sm tabular-nums">
                <div>
                  <p className="signal-label">Input</p>
                  <p className="mt-1 text-[var(--ink)]">${agent.pricing.inputCost} / 1M</p>
                </div>
                <div>
                  <p className="signal-label">Output</p>
                  <p className="mt-1 text-[var(--ink)]">${agent.pricing.outputCost} / 1M</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--mute-strong)]">No public token rate — open-weight or seat-priced.</p>
            )}
          </div>
        </section>

        {agent.releases.length > 0 && (
          <section>
            <h3 className="signal-label mb-3">Releases / changelogs</h3>
            <div className="flex flex-col gap-2">
              {agent.releases.slice(0, 3).map((release, i) => (
                <div key={i} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
                  <div className="flex items-baseline gap-2">
                    <h4 className="font-medium text-[var(--ink)]">{release.version}</h4>
                    <p className="signal-label">{new Date(release.date).toLocaleDateString()}</p>
                  </div>
                  {release.url && (
                    <a
                      href={release.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block truncate text-sm text-[var(--amber)]"
                    >
                      Changelog receipt
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function AIAgentsOverview({
  payload,
  insights,
  sources,
}: {
  payload: AIAgentsPayload | null;
  insights: AIAgentInsight[];
  sources: AttentionSourceRecord[];
}) {
  const byId = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);

  if (!payload) {
    return (
      <div className="empty-stage">
        <div className="empty-stage__body">
          <p className="empty-stage__eyebrow">HawkxAI Agent Intelligence</p>
          <h1 className="empty-stage__title">What&apos;s shifting this week</h1>
          <p className="empty-stage__copy">
            Independent attention on AI agents — public discourse velocity, not vendor benchmarks.
          </p>
        </div>
      </div>
    );
  }

  const topRoc = [...payload.agents].sort((a, b) => b.metrics.rateOfChange - a.metrics.rateOfChange)[0];

  return (
    <div className="empty-stage">
      <div className="empty-stage__head">
        <div>
          <p className="empty-stage__eyebrow">Free · This-week view</p>
          <h2 className="text-lg font-medium">Decide on attention, not last month&apos;s score</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--mute-strong)]">
            HawkxAI measures <strong className="text-[var(--ink)]">attention</strong> — mention volume plus
            rate of change across HN, Reddit, X, GitHub, and changelogs. Models ship weekly; benchmarks go
            stale. This desk is the fast layer for engineering leaders choosing a build target.
          </p>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-4">
        <section>
          <h3 className="signal-label mb-3">Window · {payload.metadata.windowLabel}</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="signal-label">Agents</p>
              <p className="mt-2 text-3xl font-medium tabular-nums text-[var(--ink)]">
                {payload.metadata.total}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="signal-label">Rising fast</p>
              <p className="mt-2 text-3xl font-medium tabular-nums text-[var(--up)]">
                {payload.metadata.risingFast}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="signal-label">Mentions</p>
              <p className="mt-2 text-3xl font-medium tabular-nums text-[var(--ink)]">
                {payload.metadata.totalMentions.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="signal-label">Data mode</p>
              <p className="mt-2 text-sm font-medium uppercase text-[var(--ink)]">{payload.dataMode}</p>
            </div>
          </div>
          {topRoc && (
            <p className="mt-3 text-sm text-[var(--mute-strong)]">
              Fastest RoC: <span className="text-[var(--ink)]">{topRoc.name}</span>{" "}
              <span className="tabular-nums text-[var(--up)]">
                {topRoc.metrics.rateOfChange >= 0 ? "+" : ""}
                {topRoc.metrics.rateOfChange.toFixed(1)}%
              </span>
            </p>
          )}
        </section>

        {insights.length > 0 && (
          <section>
            <h3 className="signal-label mb-3">Key insights</h3>
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
                      <SourceLinks
                        sources={
                          insight.sourceIds
                            .map((id) => byId.get(id))
                            .filter(Boolean) as AttentionSourceRecord[]
                        }
                        label="Evidence"
                      />
                    </div>
                    <span className="shrink-0 rounded border border-[var(--line)] px-2 py-1 text-xs font-medium uppercase text-[var(--mute)]">
                      {insight.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h3 className="signal-label mb-3">Layers</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
              <p className="signal-label">Free</p>
              <p className="mt-2 text-sm text-[var(--mute-strong)]">
                Live attention board, category/provider filters, RoC sort, source-linked metrics.
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
              <p className="signal-label">Paid</p>
              <p className="mt-2 text-sm text-[var(--mute-strong)]">
                Side-by-side compare, editable cost calculator, trajectory alerts, weekly written read.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function PaidGate({
  title,
  onUnlock,
}: {
  title: string;
  onUnlock: () => void;
}) {
  return (
    <div className="empty-stage">
      <div className="empty-stage__body">
        <p className="empty-stage__eyebrow">Paid layer</p>
        <h1 className="empty-stage__title">{title}</h1>
        <p className="empty-stage__copy">
          Compare, calculator, alerts, and the weekly read sit behind Pro. Free keeps the this-week attention board.
        </p>
        <div className="empty-stage__actions">
          <button type="button" onClick={onUnlock} className="btn-ghost">
            Unlock Pro (demo)
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AIAgentsDesk({ initialMode = "trends" }: { initialMode?: DeskMode }) {
  const [payload, setPayload] = useState<AIAgentsPayload | null>(null);
  const [insights, setInsights] = useState<AIAgentInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<AIAgentCategory | "">("");
  const [providerFilter, setProviderFilter] = useState<AIAgentProvider | "">("");
  const [trendingOnly, setTrendingOnly] = useState(false);
  const [risingOnly, setRisingOnly] = useState(false);
  const [sort, setSort] = useState<AIAgentSort>("rateOfChange");
  const [mode, setMode] = useState<DeskMode>(initialMode);
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());
  const [layer, setLayer] = useState<ProductLayer>("free");
  const booted = useRef(false);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage.getItem("hawkxai_pro") === "1") {
        setLayer("paid");
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setMode(initialMode);
    if (initialMode !== "trends" && initialMode !== "compare") {
      // paid surfaces
    }
    if (initialMode === "compare") {
      setSelectedForCompare(new Set());
    }
  }, [initialMode]);

  const unlockPro = () => {
    setLayer("paid");
    try {
      window.localStorage.setItem("hawkxai_pro", "1");
    } catch {
      /* ignore */
    }
  };

  const fetchAgents = useCallback(
    async (opts?: { refresh?: boolean; live?: boolean }) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (categoryFilter) params.set("category", categoryFilter);
        if (providerFilter) params.set("provider", providerFilter);
        if (trendingOnly) params.set("trending", "true");
        if (risingOnly) params.set("minRoc", "15");
        params.set("sort", sort);
        params.set("layer", layer);
        if (opts?.refresh) params.set("refresh", "true");
        if (opts?.live) params.set("live", "true");

        const res = await fetch(`/api/ai-agents?${params.toString()}`);
        if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
        const data = await res.json();
        setPayload(data);
        setInsights(data.insights || []);
        if (!selectedAgentId && data.agents?.[0]?.id) {
          setSelectedAgentId(data.agents[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch AI agents");
      } finally {
        setLoading(false);
      }
    },
    [categoryFilter, providerFilter, trendingOnly, risingOnly, sort, layer, selectedAgentId],
  );

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    if (!booted.current) return;
    void fetchAgents();
  }, [categoryFilter, providerFilter, trendingOnly, risingOnly, sort, layer]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedAgent = payload?.agents.find((a) => a.id === selectedAgentId) || null;

  const trendsByAgent = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const t of payload?.trends || []) {
      const arr = map.get(t.agentId) || [];
      arr.push(t.mentions);
      map.set(t.agentId, arr);
    }
    return map;
  }, [payload?.trends]);

  const handleToggleCompare = (id: string) => {
    setSelectedForCompare((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 6) next.add(id);
      return next;
    });
  };

  const compareMode = mode === "compare";
  const needsPaid = mode === "compare" || mode === "calculator" || mode === "weekly" || mode === "alerts";
  const paidBlocked = needsPaid && layer !== "paid";

  const enterMode = (next: DeskMode) => {
    setMode(next);
    if (next === "compare" && selectedForCompare.size < 2 && payload?.agents) {
      const top = payload.agents.slice(0, 2).map((a) => a.id);
      setSelectedForCompare(new Set(top));
    }
  };

  let stageLabel = "Overview";
  let stageBlurb = "This week";
  if (mode === "calculator") {
    stageLabel = "Calculator";
    stageBlurb = "Editable assumptions";
  } else if (mode === "compare") {
    stageLabel = "Compare";
    stageBlurb = `${selectedForCompare.size} agents`;
  } else if (mode === "weekly") {
    stageLabel = "Weekly";
    stageBlurb = "Sourced read";
  } else if (mode === "alerts") {
    stageLabel = "Alerts";
    stageBlurb = "Trajectory";
  }

  const stage = (() => {
    if (paidBlocked) {
      return (
        <PaidGate
          title={
            mode === "compare"
              ? "Side-by-side comparison"
              : mode === "calculator"
                ? "Cost calculator"
                : mode === "weekly"
                  ? "Weekly written read"
                  : "Trajectory alerts"
          }
          onUnlock={unlockPro}
        />
      );
    }
    if (mode === "calculator") return <CostCalculator agents={payload?.agents || []} />;
    if (mode === "weekly") {
      return <WeeklyReadPanel weekly={payload?.weekly || null} sources={payload?.sources || []} />;
    }
    if (mode === "alerts") {
      return <AlertsPanel alerts={payload?.alerts || []} sources={payload?.sources || []} />;
    }
    if (mode === "compare") {
      if (selectedForCompare.size < 2) {
        return (
          <div className="empty-stage">
            <div className="empty-stage__body">
              <p className="empty-stage__eyebrow">Compare</p>
              <h1 className="empty-stage__title">Select at least two agents</h1>
              <p className="empty-stage__copy">Check boxes in the list — comparison needs two or more.</p>
            </div>
          </div>
        );
      }
      return (
        <AIAgentsCompare
          selectedIds={Array.from(selectedForCompare)}
          onClose={() => enterMode("trends")}
        />
      );
    }
    return (
      <AIAgentsOverview payload={payload} insights={insights} sources={payload?.sources || []} />
    );
  })();

  return (
    <main className="desk-shell">
      <AmbientBackground />

      <DeskFrame
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as AIAgentSort)}
              className="field-select__control"
              aria-label="Sort"
            >
              <option value="rateOfChange">Sort: Rate of change</option>
              <option value="attention">Sort: Attention</option>
              <option value="mentions">Sort: Mentions</option>
              <option value="concentration">Sort: Concentration</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as AIAgentCategory | "")}
              className="field-select__control"
            >
              <option value="">All categories</option>
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
              <option value="">All providers</option>
              {AI_AGENT_PROVIDERS.map((prov) => (
                <option key={prov} value={prov}>
                  {prov}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setRisingOnly(!risingOnly)}
              className={`btn-ghost ${risingOnly ? "bg-[var(--amber-soft)] text-[var(--amber)]" : ""}`}
            >
              {risingOnly ? "✓ " : ""}RoC ≥ 15%
            </button>
            <button
              type="button"
              onClick={() => setTrendingOnly(!trendingOnly)}
              className={`btn-ghost ${trendingOnly ? "bg-[var(--amber-soft)] text-[var(--amber)]" : ""}`}
            >
              {trendingOnly ? "✓ " : ""}Trending
            </button>
            <button
              type="button"
              onClick={() => enterMode(mode === "compare" ? "trends" : "compare")}
              className={`btn-ghost ${mode === "compare" ? "bg-[var(--amber-soft)] text-[var(--amber)]" : ""}`}
            >
              Compare
            </button>
            <button
              type="button"
              onClick={() => enterMode(mode === "calculator" ? "trends" : "calculator")}
              className={`btn-ghost ${mode === "calculator" ? "bg-[var(--amber-soft)] text-[var(--amber)]" : ""}`}
            >
              Calculator
            </button>
          </div>
        }
        context={
          <>
            <span className="signal-label shrink-0">Agent Intelligence</span>
            {payload && (
              <>
                <StatusChip>{payload.metadata.total} agents</StatusChip>
                <StatusChip>{payload.metadata.risingFast} rising</StatusChip>
                <StatusChip>{payload.dataMode}</StatusChip>
                <StatusChip>{layer === "paid" ? "Pro" : "Free"}</StatusChip>
              </>
            )}
            {layer === "free" ? (
              <GhostButton onClick={unlockPro}>Unlock Pro</GhostButton>
            ) : (
              <GhostButton
                onClick={() => {
                  setLayer("free");
                  try {
                    window.localStorage.removeItem("hawkxai_pro");
                  } catch {
                    /* ignore */
                  }
                }}
              >
                Free mode
              </GhostButton>
            )}
            <GhostButton onClick={() => void fetchAgents({ live: true })} disabled={loading}>
              {loading ? "Refreshing…" : "Live ingest"}
            </GhostButton>
          </>
        }
      >
        <div className="desk-chrome__brand flex min-w-0 shrink-0 items-center gap-3">
          <HomeMark />
          <DeskNav active={MODE_TO_DESK[mode]} />
        </div>
      </DeskFrame>

      {error && (
        <div
          role="alert"
          className="relative z-20 mx-3 mt-2 rounded-[var(--radius-md)] border border-white/8 bg-[var(--panel-strong)] px-4 py-2.5"
        >
          <p className="signal-label">{error} — showing last good / seeded data when available.</p>
        </div>
      )}

      <DeskWorkspace
        listLabel="Agents"
        listBlurb={payload ? `${payload.agents.length} · RoC first` : "Loading…"}
        stageLabel={stageLabel}
        stageBlurb={stageBlurb}
        detailLabel="Detail"
        detailBlurb="Sources"
        preferStage={!selectedAgentId || mode !== "trends"}
        stageKey={`${mode}:${Array.from(selectedForCompare).join(",")}:${layer}`}
        list={
          <AIAgentsList
            agents={payload?.agents || []}
            selected={selectedAgentId}
            onSelect={setSelectedAgentId}
            compareMode={compareMode}
            selectedForCompare={selectedForCompare}
            onToggleCompare={handleToggleCompare}
            trendsByAgent={trendsByAgent}
          />
        }
        stage={stage}
        detail={<AIAgentDetail agent={selectedAgent} sources={payload?.sources || []} />}
      />
    </main>
  );
}
