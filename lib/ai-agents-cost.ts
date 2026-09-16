import type { AIAgent } from "./ai-agents-types";

export interface AgentCostEstimate {
  agentId: string;
  name: string;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  tier: string;
}

/** Empty, NaN, and non-numeric token fields count as 0 — same as the calculator input. */
export function parseTokenCount(raw: string): number {
  return parseInt(raw, 10) || 0;
}

/**
 * Published $/1M rates × requested tokens. Agents missing either rate are omitted
 * (Llama-style free listings stay out of the table).
 */
export function estimateAgentCosts(
  agents: Array<Pick<AIAgent, "id" | "name" | "pricing">>,
  inputTokens: number,
  outputTokens: number,
): AgentCostEstimate[] {
  return agents
    .filter((a) => a.pricing.inputCost !== undefined && a.pricing.outputCost !== undefined)
    .map((a) => {
      const inputCost = ((a.pricing.inputCost || 0) * inputTokens) / 1_000_000;
      const outputCost = ((a.pricing.outputCost || 0) * outputTokens) / 1_000_000;
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
}
