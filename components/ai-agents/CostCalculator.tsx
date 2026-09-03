"use client";

import { useState } from "react";
import type { AIAgent } from "@/lib/ai-agents-types";

interface CostEstimate {
  agentId: string;
  name: string;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  tier: string;
}

interface CostCalculatorProps {
  agents: AIAgent[];
}

export default function CostCalculator({ agents }: CostCalculatorProps) {
  const [inputTokens, setInputTokens] = useState("500000");
  const [outputTokens, setOutputTokens] = useState("500000");

  const inputCount = parseInt(inputTokens, 10) || 0;
  const outputCount = parseInt(outputTokens, 10) || 0;

  const estimates: CostEstimate[] = agents
    .filter((a) => a.pricing.inputCost !== undefined && a.pricing.outputCost !== undefined)
    .map((a) => {
      const inputCost = ((a.pricing.inputCost || 0) * inputCount) / 1_000_000;
      const outputCost = ((a.pricing.outputCost || 0) * outputCount) / 1_000_000;
      return {
        agentId: a.id,
        name: a.name,
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost,
        tier: a.pricing.tier,
      };
    })
    .sort((a, b) => a.totalCost - b.totalCost);

  const cheapest = estimates[0];
  const mostExpensive = estimates[estimates.length - 1];

  return (
    <div className="empty-stage">
      <div className="empty-stage__head">
        <div>
          <p className="empty-stage__eyebrow">Cost Calculator</p>
          <h2 className="text-lg font-medium">Estimate API Costs</h2>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-4">
        {/* Input Form */}
        <section>
          <h3 className="signal-label mb-3">Token Usage</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="input-tokens" className="signal-label mb-2 block">
                Input Tokens
              </label>
              <input
                id="input-tokens"
                type="number"
                value={inputTokens}
                onChange={(e) => setInputTokens(e.target.value)}
                min="0"
                step="10000"
                className="field-input"
                placeholder="500000"
              />
              <p className="mt-1 text-xs text-[var(--mute)]">
                {(inputCount / 1_000_000).toFixed(2)}M tokens
              </p>
            </div>
            <div>
              <label htmlFor="output-tokens" className="signal-label mb-2 block">
                Output Tokens
              </label>
              <input
                id="output-tokens"
                type="number"
                value={outputTokens}
                onChange={(e) => setOutputTokens(e.target.value)}
                min="0"
                step="10000"
                className="field-input"
                placeholder="500000"
              />
              <p className="mt-1 text-xs text-[var(--mute)]">
                {(outputCount / 1_000_000).toFixed(2)}M tokens
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setInputTokens("500000");
                setOutputTokens("500000");
              }}
              className="empty-stage__chip"
            >
              1M total (50/50)
            </button>
            <button
              type="button"
              onClick={() => {
                setInputTokens("5000000");
                setOutputTokens("5000000");
              }}
              className="empty-stage__chip"
            >
              10M total (50/50)
            </button>
            <button
              type="button"
              onClick={() => {
                setInputTokens("10000000");
                setOutputTokens("10000000");
              }}
              className="empty-stage__chip"
            >
              20M total (50/50)
            </button>
          </div>
        </section>

        {/* Summary */}
        {estimates.length > 0 && cheapest && mostExpensive && (
          <section>
            <h3 className="signal-label mb-3">Summary</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
                <p className="signal-label">Cheapest Option</p>
                <p className="mt-2 text-lg font-medium text-[var(--ink)]">{cheapest.name}</p>
                <p className="mt-1 text-2xl font-bold text-[var(--up)]">
                  ${cheapest.totalCost.toFixed(4)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
                <p className="signal-label">Most Expensive</p>
                <p className="mt-2 text-lg font-medium text-[var(--ink)]">{mostExpensive.name}</p>
                <p className="mt-1 text-2xl font-bold text-[var(--down)]">
                  ${mostExpensive.totalCost.toFixed(4)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
                <p className="signal-label">Price Difference</p>
                <p className="mt-2 text-lg font-medium text-[var(--ink)]">
                  {(mostExpensive.totalCost / cheapest.totalCost).toFixed(1)}x
                </p>
                <p className="mt-1 text-sm text-[var(--mute-strong)]">
                  ${(mostExpensive.totalCost - cheapest.totalCost).toFixed(4)} more
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Cost Breakdown */}
        <section>
          <h3 className="signal-label mb-3">Cost Breakdown</h3>
          {estimates.length === 0 ? (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
              <p className="text-sm text-[var(--mute-strong)]">
                No agents with public pricing information available
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="watch-table">
                <thead>
                  <tr>
                    <th className="text-left">Agent</th>
                    <th className="text-left">Tier</th>
                    <th className="text-right">Input Cost</th>
                    <th className="text-right">Output Cost</th>
                    <th className="text-right">Total Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {estimates.map((est) => (
                    <tr key={est.agentId}>
                      <td className="font-medium">{est.name}</td>
                      <td className="uppercase">
                        <span className="signal-label">{est.tier}</span>
                      </td>
                      <td className="text-right tabular">${est.inputCost.toFixed(4)}</td>
                      <td className="text-right tabular">${est.outputCost.toFixed(4)}</td>
                      <td className="text-right font-medium tabular">
                        <span
                          className={
                            est.agentId === cheapest?.agentId
                              ? "text-[var(--up)]"
                              : est.agentId === mostExpensive?.agentId
                                ? "text-[var(--down)]"
                                : ""
                          }
                        >
                          ${est.totalCost.toFixed(4)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Recommendations */}
        {estimates.length > 0 && (
          <section>
            <h3 className="signal-label mb-3">Recommendations</h3>
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
                <h4 className="font-medium text-[var(--ink)]">💰 Best Value</h4>
                <p className="mt-2 text-sm text-[var(--mute-strong)]">
                  <strong>{cheapest.name}</strong> offers the lowest cost at{" "}
                  <strong>${cheapest.totalCost.toFixed(4)}</strong> for this usage.
                </p>
              </div>
              {estimates.length > 2 && (
                <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
                  <h4 className="font-medium text-[var(--ink)]">📊 Mid-Range Options</h4>
                  <p className="mt-2 text-sm text-[var(--mute-strong)]">
                    {estimates.slice(1, -1).length} agent(s) fall between ${cheapest.totalCost.toFixed(4)} and $
                    {mostExpensive.totalCost.toFixed(4)}
                  </p>
                </div>
              )}
              <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
                <h4 className="font-medium text-[var(--ink)]">💎 Premium Option</h4>
                <p className="mt-2 text-sm text-[var(--mute-strong)]">
                  <strong>{mostExpensive.name}</strong> is the most expensive at{" "}
                  <strong>${mostExpensive.totalCost.toFixed(4)}</strong> (
                  {(mostExpensive.totalCost / cheapest.totalCost).toFixed(1)}x more than cheapest)
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Notes */}
        <section>
          <h3 className="signal-label mb-3">Notes</h3>
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
            <ul className="flex flex-col gap-2 text-sm text-[var(--mute-strong)]">
              <li>• Costs are estimates based on published pricing</li>
              <li>• Actual costs may vary based on volume discounts and rate limits</li>
              <li>• Free/open-source models (Llama, etc.) are not included in calculations</li>
              <li>• Consider capability scores alongside pricing for best value</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
