import type { AIAgent } from "./ai-agents-types";

export interface ComparisonAgent {
  id: string;
  name: string;
  provider: string;
  category: string;
}

export interface CapabilityComparison {
  name: string;
  scores: Record<string, number>; // agentId -> score
  leader: string; // agent id with highest score
  avgScore: number;
}

export interface PricingComparison {
  agentId: string;
  name: string;
  tier: string;
  inputCost: number | null;
  outputCost: number | null;
  totalCost1M: number | null; // Total cost for 1M tokens (assuming 50/50 split)
}

export interface MetricsComparison {
  agentId: string;
  name: string;
  mentions: number;
  velocity: string;
  sentiment: string;
  weeklyChange: number;
  rateOfChange: number;
  attention: number;
  trendScore: number;
}

export interface ComparisonResult {
  agents: ComparisonAgent[];
  capabilities: CapabilityComparison[];
  pricing: PricingComparison[];
  metrics: MetricsComparison[];
  summary: {
    overallLeader: string;
    bestValue: string; // Best price/performance
    fastest: string; // Highest velocity
    mostCapable: string; // Highest avg capability score
  };
  insights: string[];
}

export function compareAgents(agents: AIAgent[]): ComparisonResult {
  if (agents.length === 0) {
    return {
      agents: [],
      capabilities: [],
      pricing: [],
      metrics: [],
      summary: {
        overallLeader: "",
        bestValue: "",
        fastest: "",
        mostCapable: "",
      },
      insights: [],
    };
  }

  // Build comparison agents list
  const comparisonAgents: ComparisonAgent[] = agents.map((a) => ({
    id: a.id,
    name: a.name,
    provider: a.provider,
    category: a.category,
  }));

  // Build capability comparisons
  const capabilityMap = new Map<string, Map<string, number>>();
  
  for (const agent of agents) {
    for (const cap of agent.capabilities) {
      if (!capabilityMap.has(cap.name)) {
        capabilityMap.set(cap.name, new Map());
      }
      capabilityMap.get(cap.name)!.set(agent.id, cap.score);
    }
  }

  const capabilities: CapabilityComparison[] = [];
  for (const [name, scores] of capabilityMap) {
    const scoreArray = Array.from(scores.values());
    const avgScore = scoreArray.reduce((a, b) => a + b, 0) / scoreArray.length;
    const leader = Array.from(scores.entries()).sort((a, b) => b[1] - a[1])[0][0];
    
    capabilities.push({
      name,
      scores: Object.fromEntries(scores),
      leader,
      avgScore,
    });
  }

  // Sort by average score descending
  capabilities.sort((a, b) => b.avgScore - a.avgScore);

  // Build pricing comparisons
  const pricing: PricingComparison[] = agents.map((a) => {
    const inputCost = a.pricing.inputCost ?? null;
    const outputCost = a.pricing.outputCost ?? null;
    const totalCost1M = inputCost !== null && outputCost !== null
      ? (inputCost * 0.5 + outputCost * 0.5) // 50/50 split assumption
      : null;

    return {
      agentId: a.id,
      name: a.name,
      tier: a.pricing.tier,
      inputCost,
      outputCost,
      totalCost1M,
    };
  });

  // Sort by total cost ascending (free first)
  pricing.sort((a, b) => {
    if (a.totalCost1M === null) return -1;
    if (b.totalCost1M === null) return 1;
    return a.totalCost1M - b.totalCost1M;
  });

  // Build metrics comparisons — attention / RoC, never adoption
  const metrics: MetricsComparison[] = agents.map((a) => ({
    agentId: a.id,
    name: a.name,
    mentions: a.metrics.mentions,
    velocity: a.metrics.velocity,
    sentiment: a.metrics.sentiment,
    weeklyChange: a.metrics.rateOfChange,
    rateOfChange: a.metrics.rateOfChange,
    attention: a.metrics.attention,
    trendScore: a.metrics.attention,
  }));

  // Sort by rate of change first (speed wedge)
  metrics.sort((a, b) => b.rateOfChange - a.rateOfChange);

  // Calculate summary
  const overallLeader = [...metrics].sort((a, b) => b.attention - a.attention)[0]?.agentId || "";
  
  const bestValue = pricing.find((p) => p.totalCost1M !== null)?.agentId || pricing[0]?.agentId || "";
  
  const fastest = [...metrics].sort((a, b) => b.rateOfChange - a.rateOfChange)[0]?.agentId || "";
  
  // Calculate average capability score per agent
  const agentCapScores = agents.map((a) => ({
    id: a.id,
    avgScore: a.capabilities.reduce((sum, c) => sum + c.score, 0) / a.capabilities.length,
  }));
  const mostCapable = agentCapScores.sort((a, b) => b.avgScore - a.avgScore)[0]?.id || "";

  // Generate insights
  const insights: string[] = [];

  // Capability insights
  if (capabilities.length > 0) {
    const topCap = capabilities[0];
    const leaderAgent = agents.find((a) => a.id === topCap.leader);
    if (leaderAgent) {
      insights.push(
        `${leaderAgent.name} leads in ${topCap.name} with a score of ${topCap.scores[topCap.leader]}/100`
      );
    }
  }

  // Pricing insights
  const freeAgents = pricing.filter((p) => p.tier === "free");
  if (freeAgents.length > 0) {
    insights.push(`${freeAgents.length} free/open-source option${freeAgents.length > 1 ? "s" : ""} available`);
  }

  const cheapest = pricing.find((p) => p.totalCost1M !== null);
  const mostExpensive = pricing.filter((p) => p.totalCost1M !== null).sort((a, b) => b.totalCost1M! - a.totalCost1M!)[0];
  if (cheapest && mostExpensive && cheapest.agentId !== mostExpensive.agentId) {
    const ratio = (mostExpensive.totalCost1M! / cheapest.totalCost1M!).toFixed(1);
    insights.push(`Price range: ${ratio}x difference between cheapest and most expensive`);
  }

  // Velocity insights — attention, not adoption
  const rising = metrics.filter((m) => m.velocity === "rising");
  if (rising.length > 0) {
    insights.push(`${rising.length} agent${rising.length > 1 ? "s" : ""} showing rising attention (RoC)`);
  }

  // Sentiment insights
  const positive = metrics.filter((m) => m.sentiment === "positive");
  if (positive.length > 0) {
    insights.push(`${positive.length}/${metrics.length} agents have positive sentiment`);
  }

  return {
    agents: comparisonAgents,
    capabilities,
    pricing,
    metrics,
    summary: {
      overallLeader,
      bestValue,
      fastest,
      mostCapable,
    },
    insights,
  };
}

export function generateComparisonMarkdown(comparison: ComparisonResult): string {
  let md = "# AI Agents Comparison\n\n";

  md += "## Summary\n\n";
  const { summary } = comparison;
  const agentName = (id: string) => comparison.agents.find((a) => a.id === id)?.name || id;
  
  md += `- **Overall Leader**: ${agentName(summary.overallLeader)}\n`;
  md += `- **Best Value**: ${agentName(summary.bestValue)}\n`;
  md += `- **Fastest Growing**: ${agentName(summary.fastest)}\n`;
  md += `- **Most Capable**: ${agentName(summary.mostCapable)}\n\n`;

  md += "## Key Insights\n\n";
  for (const insight of comparison.insights) {
    md += `- ${insight}\n`;
  }
  md += "\n";

  md += "## Capabilities Comparison\n\n";
  md += "| Capability | " + comparison.agents.map((a) => a.name).join(" | ") + " |\n";
  md += "|------------|" + comparison.agents.map(() => "------").join("|") + "|\n";
  
  for (const cap of comparison.capabilities) {
    const scores = comparison.agents.map((a) => {
      const score = cap.scores[a.id];
      const isLeader = a.id === cap.leader;
      return score ? (isLeader ? `**${score}** ⭐` : `${score}`) : "—";
    });
    md += `| ${cap.name} | ${scores.join(" | ")} |\n`;
  }
  md += "\n";

  md += "## Pricing Comparison\n\n";
  md += "| Agent | Tier | Input ($/1M) | Output ($/1M) | Total ($/1M)* |\n";
  md += "|-------|------|--------------|---------------|---------------|\n";
  
  for (const p of comparison.pricing) {
    const input = p.inputCost !== null ? `$${p.inputCost}` : "—";
    const output = p.outputCost !== null ? `$${p.outputCost}` : "—";
    const total = p.totalCost1M !== null ? `$${p.totalCost1M.toFixed(2)}` : p.tier === "free" ? "Free" : "—";
    md += `| ${p.name} | ${p.tier} | ${input} | ${output} | ${total} |\n`;
  }
  md += "\n*Assuming 50/50 input/output split\n\n";

  md += "## Attention Metrics Comparison\n\n";
  md += "| Agent | Mentions | RoC | Attention | Velocity | Sentiment |\n";
  md += "|-------|----------|-----|-----------|----------|-----------|\n";
  
  for (const m of comparison.metrics) {
    const change = m.rateOfChange >= 0 ? `+${m.rateOfChange.toFixed(1)}%` : `${m.rateOfChange.toFixed(1)}%`;
    md += `| ${m.name} | ${m.mentions.toLocaleString()} | ${change} | ${m.attention} | ${m.velocity} | ${m.sentiment} |\n`;
  }

  return md;
}
