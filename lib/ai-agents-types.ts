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

export interface AIAgentMetrics {
  mentions: number;
  sentiment: "positive" | "negative" | "mixed" | "neutral";
  velocity: "rising" | "peaking" | "fading" | "stable";
  trending: boolean;
  trend_score: number;
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
  description: string;
  capabilities: AIAgentCapability[];
  pricing: AIAgentPricing;
  metrics: AIAgentMetrics;
  releases: AIAgentRelease[];
  officialUrl?: string;
  docsUrl?: string;
  apiUrl?: string;
  githubUrl?: string;
  launchDate: string;
  lastUpdated: string;
  tags: string[];
}

export interface AIAgentTrend {
  agentId: string;
  timestamp: string;
  mentions: number;
  sentiment: number; // -1 to 1
  platforms: Record<string, number>;
  topics: string[];
  hashtags: string[];
  urls: string[];
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

export interface AIAgentsPayload {
  agents: AIAgent[];
  trends: AIAgentTrend[];
  comparison?: AIAgentComparison;
  updatedAt: string;
  metadata: {
    total: number;
    byCategory: Record<AIAgentCategory, number>;
    byProvider: Record<AIAgentProvider, number>;
    trending: number;
  };
}

export interface AIAgentFilter {
  category?: AIAgentCategory;
  provider?: AIAgentProvider;
  trending?: boolean;
  minMentions?: number;
  pricingTier?: AIAgentPricing["tier"];
}

export interface AIAgentInsight {
  type: "capability" | "pricing" | "adoption" | "competition" | "innovation";
  title: string;
  description: string;
  agents: string[];
  confidence: number;
  evidence: string[];
}
