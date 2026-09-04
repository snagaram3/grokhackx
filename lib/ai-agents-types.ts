export const AI_AGENT_CATEGORIES = [
  "code-generation",
  "reasoning",
  "multimodal",
  "search",
  "automation",
  "analysis",
  "creative",
  "enterprise",
] as const;

export type AIAgentCategory = (typeof AI_AGENT_CATEGORIES)[number];

export const AI_AGENT_PROVIDERS = [
  "openai",
  "anthropic",
  "google",
  "meta",
  "mistral",
  "cohere",
  "huggingface",
  "open-source",
  "other",
] as const;

export type AIAgentProvider = (typeof AI_AGENT_PROVIDERS)[number];

export const ATTENTION_SOURCES = [
  "hn",
  "reddit",
  "x",
  "github",
  "changelog",
  "public",
] as const;

export type AttentionSource = (typeof ATTENTION_SOURCES)[number];

export type ProductLayer = "free" | "paid";

export type DeskMode = "trends" | "compare" | "calculator" | "weekly" | "alerts";

export interface AIAgentCapability {
  name: string;
  description: string;
  score: number; // 0-100
}

export interface AIAgentPricing {
  tier: "free" | "freemium" | "paid" | "enterprise";
  inputCost?: number; // per million tokens
  outputCost?: number; // per million tokens
  currency?: string;
}

/** Public discourse signal — never labeled "adoption". */
export interface AIAgentMetrics {
  /** Raw mention volume across tracked sources (this window). */
  mentions: number;
  /** Prior-window mentions used for rate-of-change. */
  mentionsPrior: number;
  /** Rate of change vs prior window, percent. First-class sort key. */
  rateOfChange: number;
  /** Attention score: volume + RoC (RoC weighted higher). */
  attention: number;
  /** Share of total attention across tracked agents (0–1). */
  concentration: number;
  /** Risk flag when concentration or source mix is skewed. */
  risk: "low" | "medium" | "high";
  sentiment: "positive" | "negative" | "mixed" | "neutral";
  velocity: "rising" | "peaking" | "fading" | "stable";
  trending: boolean;
  /** @deprecated Prefer attention. Kept for compare API compat. */
  trend_score: number;
  /** @deprecated Prefer rateOfChange. */
  weekly_change: number;
}

export interface AIAgentRelease {
  version: string;
  date: string;
  features: string[];
  url?: string;
}

export interface AIAgent {
  id: string;
  name: string;
  provider: AIAgentProvider;
  category: AIAgentCategory;
  /** Extra capability categories this agent covers. */
  categories: AIAgentCategory[];
  description: string;
  capabilities: AIAgentCapability[];
  pricing: AIAgentPricing;
  metrics: AIAgentMetrics;
  releases: AIAgentRelease[];
  searchTerms: string[];
  officialUrl?: string;
  docsUrl?: string;
  apiUrl?: string;
  githubUrl?: string;
  changelogUrl?: string;
  launchDate: string;
  lastUpdated: string;
  tags: string[];
}

/** One raw source receipt — every on-screen number must point here. */
export interface AttentionSourceRecord {
  id: string;
  agentId: string;
  platform: AttentionSource;
  title: string;
  url: string;
  score: number;
  createdAt: string;
  tool: string;
  collectedAt: string;
  /** Which metric bucket this receipt contributed to. */
  metric: "mentions" | "rateOfChange" | "attention";
}

export interface AIAgentTrendPoint {
  agentId: string;
  date: string;
  mentions: number;
  platforms: Partial<Record<AttentionSource, number>>;
}

export interface AIAgentTrend {
  agentId: string;
  timestamp: string;
  mentions: number;
  sentiment: number;
  platforms: Record<string, number>;
  topics: string[];
  hashtags: string[];
  urls: string[];
}

export interface AIAgentAlert {
  id: string;
  agentId: string;
  agentName: string;
  kind: "roc_spike" | "roc_drop" | "concentration" | "source_shift";
  title: string;
  body: string;
  rateOfChange: number;
  attention: number;
  triggeredAt: string;
  sourceIds: string[];
  layer: "paid";
}

export interface WeeklyReadClaim {
  text: string;
  agentIds: string[];
  sourceIds: string[];
  metric: "attention" | "rateOfChange" | "mentions" | "concentration";
}

export interface WeeklyRead {
  id: string;
  weekOf: string;
  title: string;
  summary: string;
  sections: {
    heading: string;
    body: string;
    claims: WeeklyReadClaim[];
  }[];
  generatedAt: string;
  layer: "paid";
  /** Every claim is backed by source ids from the same store. */
  sourceCount: number;
}

export interface AIAgentComparison {
  agents: AIAgent[];
  matrix: {
    capability: string;
    scores: Record<string, number>;
  }[];
  insights: {
    leader: string;
    rising: string[];
    declining: string[];
    summary: string;
  };
}

export type AIAgentSort = "attention" | "rateOfChange" | "mentions" | "concentration";

export interface AIAgentsPayload {
  agents: AIAgent[];
  trends: AIAgentTrendPoint[];
  sources: AttentionSourceRecord[];
  alerts: AIAgentAlert[];
  weekly?: WeeklyRead;
  updatedAt: string;
  dataMode: "seeded" | "live" | "mixed";
  layer: ProductLayer;
  metadata: {
    total: number;
    byCategory: Record<string, number>;
    byProvider: Record<string, number>;
    trending: number;
    risingFast: number;
    totalMentions: number;
    windowLabel: string;
  };
}

export interface AIAgentFilter {
  category?: AIAgentCategory;
  provider?: AIAgentProvider;
  trending?: boolean;
  minMentions?: number;
  minRateOfChange?: number;
  pricingTier?: AIAgentPricing["tier"];
  sort?: AIAgentSort;
}

export interface AIAgentInsight {
  type: "capability" | "pricing" | "attention" | "competition" | "innovation";
  title: string;
  description: string;
  agents: string[];
  confidence: number;
  evidence: string[];
  sourceIds: string[];
}
