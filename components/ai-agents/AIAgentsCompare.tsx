"use client";

import { useEffect, useState } from "react";
import type { ComparisonResult } from "@/lib/ai-agents-compare";

interface AIAgentsCompareProps {
  selectedIds: string[];
  onClose: () => void;
}

export default function AIAgentsCompare({ selectedIds, onClose }: AIAgentsCompareProps) {
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedIds.length < 2) return;

    const fetchComparison = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/ai-agents/compare?ids=${selectedIds.join(",")}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Failed to compare (${res.status})`);
        }
        const data = await res.json();
        setComparison(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to compare agents");
      } finally {
        setLoading(false);
      }
    };

    void fetchComparison();
  }, [selectedIds]);

  if (selectedIds.length < 2) {
    return (
      <div className="empty-stage">
        <div className="empty-stage__body">
          <p className="empty-stage__eyebrow">Compare Agents</p>
          <h1 className="empty-stage__title">Select at least 2 agents</h1>
          <p className="empty-stage__copy">
            Choose agents from the list to compare their capabilities, pricing, and metrics
          </p>
          <div className="empty-stage__actions">
            <button type="button" onClick={onClose} className="btn-ghost">
              Back to List
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="empty-stage">
        <div className="empty-stage__body">
          <p className="empty-stage__eyebrow">Comparing {selectedIds.length} agents</p>
          <h1 className="empty-stage__title">Loading comparison...</h1>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-stage">
        <div className="empty-stage__body">
          <p className="empty-stage__eyebrow">Error</p>
          <h1 className="empty-stage__title">{error}</h1>
          <div className="empty-stage__actions">
            <button type="button" onClick={onClose} className="btn-ghost">
              Back to List
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!comparison) return null;

  const getAgentName = (id: string) => comparison.agents.find((a) => a.id === id)?.name || id;

  return (
    <div className="empty-stage">
      <div className="empty-stage__head">
        <div>
          <p className="empty-stage__eyebrow">Paid · Compare</p>
          <h2 className="text-lg font-medium">{comparison.agents.map((a) => a.name).join(" vs ")}</h2>
        </div>
        <button type="button" onClick={onClose} className="btn-ghost">
          Close
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-4">
        {/* Summary */}
        <section>
          <h3 className="signal-label mb-3">Summary</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="signal-label">Overall Leader</p>
              <p className="mt-2 text-lg font-medium text-[var(--ink)]">
                {getAgentName(comparison.summary.overallLeader)}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="signal-label">Most Capable</p>
              <p className="mt-2 text-lg font-medium text-[var(--ink)]">
                {getAgentName(comparison.summary.mostCapable)}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="signal-label">Best Value</p>
              <p className="mt-2 text-lg font-medium text-[var(--ink)]">
                {getAgentName(comparison.summary.bestValue)}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="signal-label">Fastest RoC</p>
              <p className="mt-2 text-lg font-medium text-[var(--ink)]">
                {getAgentName(comparison.summary.fastest)}
              </p>
            </div>
          </div>
        </section>

        {/* Insights */}
        {comparison.insights.length > 0 && (
          <section>
            <h3 className="signal-label mb-3">Key Insights</h3>
            <div className="flex flex-col gap-2">
              {comparison.insights.map((insight, i) => (
                <div key={i} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
                  <p className="text-sm text-[var(--mute-strong)]">• {insight}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Capabilities */}
        <section>
          <h3 className="signal-label mb-3">Capabilities Comparison</h3>
          <div className="overflow-x-auto">
            <table className="watch-table">
              <thead>
                <tr>
                  <th className="text-left">Capability</th>
                  {comparison.agents.map((agent) => (
                    <th key={agent.id} className="text-center">
                      {agent.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.capabilities.map((cap) => (
                  <tr key={cap.name}>
                    <td className="font-medium">{cap.name}</td>
                    {comparison.agents.map((agent) => {
                      const score = cap.scores[agent.id];
                      const isLeader = agent.id === cap.leader;
                      return (
                        <td key={agent.id} className="text-center">
                          {score !== undefined ? (
                            <span className={isLeader ? "font-bold text-[var(--amber)]" : ""}>
                              {score}
                              {isLeader && " ⭐"}
                            </span>
                          ) : (
                            <span className="text-[var(--mute)]">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Pricing */}
        <section>
          <h3 className="signal-label mb-3">Pricing Comparison</h3>
          <div className="overflow-x-auto">
            <table className="watch-table">
              <thead>
                <tr>
                  <th className="text-left">Agent</th>
                  <th className="text-left">Tier</th>
                  <th className="text-right">Input ($/1M)</th>
                  <th className="text-right">Output ($/1M)</th>
                  <th className="text-right">Total ($/1M)*</th>
                </tr>
              </thead>
              <tbody>
                {comparison.pricing.map((p) => (
                  <tr key={p.agentId}>
                    <td className="font-medium">{p.name}</td>
                    <td className="uppercase">
                      <span className="signal-label">{p.tier}</span>
                    </td>
                    <td className="text-right tabular">
                      {p.inputCost !== null ? `$${p.inputCost}` : "—"}
                    </td>
                    <td className="text-right tabular">
                      {p.outputCost !== null ? `$${p.outputCost}` : "—"}
                    </td>
                    <td className="text-right font-medium tabular">
                      {p.totalCost1M !== null
                        ? `$${p.totalCost1M.toFixed(2)}`
                        : p.tier === "free"
                          ? "Free"
                          : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-[var(--mute)]">*Assuming 50/50 input/output split</p>
          </div>
        </section>

        {/* Attention metrics */}
        <section>
          <h3 className="signal-label mb-3">Attention comparison</h3>
          <div className="overflow-x-auto">
            <table className="watch-table">
              <thead>
                <tr>
                  <th className="text-left">Agent</th>
                  <th className="text-right">Mentions</th>
                  <th className="text-right">RoC</th>
                  <th className="text-right">Attention</th>
                  <th className="text-left">Velocity</th>
                  <th className="text-left">Sentiment</th>
                </tr>
              </thead>
              <tbody>
                {comparison.metrics.map((m) => {
                  const roc = m.rateOfChange ?? m.weeklyChange;
                  const attention = m.attention ?? m.trendScore;
                  return (
                  <tr key={m.agentId}>
                    <td className="font-medium">{m.name}</td>
                    <td className="text-right tabular-nums">{m.mentions.toLocaleString()}</td>
                    <td className={`text-right font-medium tabular-nums ${roc >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>
                      {roc >= 0 ? "+" : ""}
                      {roc.toFixed(1)}%
                    </td>
                    <td className="text-right font-medium tabular-nums">{attention}</td>
                    <td className="uppercase">
                      <span className="signal-label">{m.velocity}</span>
                    </td>
                    <td className="uppercase">
                      <span className="signal-label">{m.sentiment}</span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-[var(--mute)]">Attention is public discourse signal — not adoption.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
