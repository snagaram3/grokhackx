"use client";

import { useMemo, useState } from "react";
import type { AIAgent } from "@/lib/ai-agents-types";

interface CostEstimate {
  agentId: string;
  name: string;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  tier: string;
  inputRate: number;
  outputRate: number;
}

interface CostCalculatorProps {
  agents: AIAgent[];
}

export default function CostCalculator({ agents }: CostCalculatorProps) {
  const [inputTokens, setInputTokens] = useState("500000");
  const [outputTokens, setOutputTokens] = useState("500000");
  const [inputShare, setInputShare] = useState("50");
  const [rateOverrides, setRateOverrides] = useState<Record<string, { input?: string; output?: string }>>({});

  const inputCount = parseInt(inputTokens, 10) || 0;
  const outputCount = parseInt(outputTokens, 10) || 0;
  const share = Math.min(100, Math.max(0, parseFloat(inputShare) || 50));

  const priced = useMemo(
    () => agents.filter((a) => a.pricing.inputCost !== undefined && a.pricing.outputCost !== undefined),
    [agents],
  );

  const estimates: CostEstimate[] = priced
    .map((a) => {
      const ov = rateOverrides[a.id] || {};
      const inputRate = ov.input !== undefined && ov.input !== ""
        ? parseFloat(ov.input)
        : (a.pricing.inputCost || 0);
      const outputRate = ov.output !== undefined && ov.output !== ""
        ? parseFloat(ov.output)
        : (a.pricing.outputCost || 0);
      const inputCost = (inputRate * inputCount) / 1_000_000;
      const outputCost = (outputRate * outputCount) / 1_000_000;
      return {
        agentId: a.id,
        name: a.name,
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost,
        tier: a.pricing.tier,
        inputRate,
        outputRate,
      };
    })
    .sort((a, b) => a.totalCost - b.totalCost);

  const cheapest = estimates[0];
  const mostExpensive = estimates[estimates.length - 1];

  const setRate = (agentId: string, field: "input" | "output", value: string) => {
    setRateOverrides((prev) => ({
      ...prev,
      [agentId]: { ...prev[agentId], [field]: value },
    }));
  };

  const applySplitPreset = (totalMillions: number) => {
    const total = totalMillions * 1_000_000;
    const inTok = Math.round((total * share) / 100);
    setInputTokens(String(inTok));
    setOutputTokens(String(total - inTok));
  };

  return (
    <div className="empty-stage">
      <div className="empty-stage__head">
        <div>
          <p className="empty-stage__eyebrow">Paid · Cost calculator</p>
          <h2 className="text-lg font-medium">Estimate API costs</h2>
          <p className="mt-1 text-sm text-[var(--mute-strong)]">
            Assumptions are visible and editable — rates ($/1M) and input/output split.
          </p>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-4">
        <section>
          <h3 className="signal-label mb-3">Token usage</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="input-tokens" className="signal-label mb-2 block">
                Input tokens
              </label>
              <input
                id="input-tokens"
                type="number"
                value={inputTokens}
                onChange={(e) => setInputTokens(e.target.value)}
                min="0"
                step="10000"
                className="field-input"
              />
            </div>
            <div>
              <label htmlFor="output-tokens" className="signal-label mb-2 block">
                Output tokens
              </label>
              <input
                id="output-tokens"
                type="number"
                value={outputTokens}
                onChange={(e) => setOutputTokens(e.target.value)}
                min="0"
                step="10000"
                className="field-input"
              />
            </div>
            <div>
              <label htmlFor="input-share" className="signal-label mb-2 block">
                Input share for presets (%)
              </label>
              <input
                id="input-share"
                type="number"
                value={inputShare}
                onChange={(e) => setInputShare(e.target.value)}
                min="0"
                max="100"
                step="5"
                className="field-input"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => applySplitPreset(1)} className="empty-stage__chip">
              1M total
            </button>
            <button type="button" onClick={() => applySplitPreset(10)} className="empty-stage__chip">
              10M total
            </button>
            <button type="button" onClick={() => applySplitPreset(20)} className="empty-stage__chip">
              20M total
            </button>
            <button
              type="button"
              onClick={() => setRateOverrides({})}
              className="empty-stage__chip"
            >
              Reset rate overrides
            </button>
          </div>
        </section>

        <section>
          <h3 className="signal-label mb-3">Editable rate assumptions ($ / 1M tokens)</h3>
          {priced.length === 0 ? (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
              <p className="text-sm text-[var(--mute-strong)]">
                No agents with published token rates in this filter set.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="watch-table">
                <thead>
                  <tr>
                    <th className="text-left">Agent</th>
                    <th className="text-right">Input $/1M</th>
                    <th className="text-right">Output $/1M</th>
                    <th className="text-right">Est. total</th>
                  </tr>
                </thead>
                <tbody>
                  {estimates.map((est) => (
                    <tr key={est.agentId}>
                      <td className="font-medium">{est.name}</td>
                      <td className="text-right">
                        <input
                          type="number"
                          step="0.01"
                          className="field-input w-24 text-right tabular-nums"
                          value={rateOverrides[est.agentId]?.input ?? String(est.inputRate)}
                          onChange={(e) => setRate(est.agentId, "input", e.target.value)}
                          aria-label={`${est.name} input rate`}
                        />
                      </td>
                      <td className="text-right">
                        <input
                          type="number"
                          step="0.01"
                          className="field-input w-24 text-right tabular-nums"
                          value={rateOverrides[est.agentId]?.output ?? String(est.outputRate)}
                          onChange={(e) => setRate(est.agentId, "output", e.target.value)}
                          aria-label={`${est.name} output rate`}
                        />
                      </td>
                      <td className="text-right font-medium tabular-nums">
                        ${est.totalCost.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {estimates.length > 0 && cheapest && mostExpensive && (
          <section>
            <h3 className="signal-label mb-3">Summary</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
                <p className="signal-label">Cheapest</p>
                <p className="mt-2 text-lg font-medium text-[var(--ink)]">{cheapest.name}</p>
                <p className="mt-1 text-2xl font-medium tabular-nums text-[var(--up)]">
                  ${cheapest.totalCost.toFixed(4)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
                <p className="signal-label">Most expensive</p>
                <p className="mt-2 text-lg font-medium text-[var(--ink)]">{mostExpensive.name}</p>
                <p className="mt-1 text-2xl font-medium tabular-nums text-[var(--down)]">
                  ${mostExpensive.totalCost.toFixed(4)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
                <p className="signal-label">Spread</p>
                <p className="mt-2 text-lg font-medium tabular-nums text-[var(--ink)]">
                  {cheapest.totalCost > 0
                    ? `${(mostExpensive.totalCost / cheapest.totalCost).toFixed(1)}x`
                    : "—"}
                </p>
              </div>
            </div>
          </section>
        )}

        <section>
          <h3 className="signal-label mb-3">Assumptions</h3>
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
            <ul className="flex flex-col gap-2 text-sm text-[var(--mute-strong)]">
              <li>• Default rates come from published provider pricing on each agent card.</li>
              <li>• You can override any $/1M rate above; estimates recompute immediately.</li>
              <li>• Preset totals use the editable input-share split ({share}% input).</li>
              <li>• Free/open-weight models without token rates are omitted from dollar totals.</li>
              <li>• This is cost modeling — not attention or adoption.</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
