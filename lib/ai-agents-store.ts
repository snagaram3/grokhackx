import type {
  AIAgent,
  AIAgentCategory,
  AIAgentFilter,
  AIAgentInsight,
  AIAgentMetrics,
  AIAgentProvider,
  AIAgentsPayload,
  AIAgentTrend,
} from "./ai-agents-types";

// Seed data for popular AI agents
const SEED_AGENTS: Omit<AIAgent, "metrics" | "lastUpdated">[] = [
  {
    id: "gpt-4",
    name: "GPT-4",
    provider: "openai",
    category: "reasoning",
    description: "OpenAI's most advanced language model with superior reasoning capabilities",
    capabilities: [
      { name: "Code Generation", description: "Generate high-quality code", score: 95 },
      { name: "Reasoning", description: "Complex problem solving", score: 98 },
      { name: "Multimodal", description: "Text and image understanding", score: 90 },
    ],
    pricing: { tier: "paid", inputCost: 30, outputCost: 60, currency: "USD" },
    releases: [
      { version: "4.0", date: "2023-03-14", features: ["Multimodal input", "Advanced reasoning"] },
      { version: "4-turbo", date: "2023-11-06", features: ["128K context", "Better performance"] },
    ],
    officialUrl: "https://openai.com/gpt-4",
    docsUrl: "https://platform.openai.com/docs",
    apiUrl: "https://api.openai.com",
    launchDate: "2023-03-14",
    tags: ["reasoning", "multimodal", "production-ready"],
  },
  {
    id: "claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    category: "code-generation",
    description: "Anthropic's most intelligent model with industry-leading coding capabilities",
    capabilities: [
      { name: "Code Generation", description: "Superior code quality", score: 98 },
      { name: "Analysis", description: "Deep analytical thinking", score: 96 },
      { name: "Safety", description: "Constitutional AI safety", score: 99 },
    ],
    pricing: { tier: "paid", inputCost: 3, outputCost: 15, currency: "USD" },
    releases: [
      { version: "3.5", date: "2024-06-20", features: ["Enhanced coding", "200K context"] },
    ],
    officialUrl: "https://anthropic.com/claude",
    docsUrl: "https://docs.anthropic.com",
    apiUrl: "https://api.anthropic.com",
    launchDate: "2024-06-20",
    tags: ["coding", "safety", "analysis"],
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    category: "multimodal",
    description: "Google's latest multimodal AI with native image and video understanding",
    capabilities: [
      { name: "Multimodal", description: "Native multimodal reasoning", score: 97 },
      { name: "Speed", description: "Ultra-fast inference", score: 95 },
      { name: "Code", description: "Strong coding abilities", score: 92 },
    ],
    pricing: { tier: "freemium", inputCost: 0.075, outputCost: 0.30, currency: "USD" },
    releases: [
      { version: "2.0", date: "2024-12-11", features: ["Native multimodal", "2M context"] },
    ],
    officialUrl: "https://deepmind.google/gemini",
    docsUrl: "https://ai.google.dev/docs",
    apiUrl: "https://generativelanguage.googleapis.com",
    launchDate: "2024-12-11",
    tags: ["multimodal", "fast", "google"],
  },
  {
    id: "llama-3",
    name: "Llama 3",
    provider: "meta",
    category: "automation",
    description: "Meta's open-source large language model for deployment flexibility",
    capabilities: [
      { name: "Open Source", description: "Free to use and modify", score: 100 },
      { name: "Performance", description: "Strong general capabilities", score: 88 },
      { name: "Deployment", description: "Self-hosted flexibility", score: 95 },
    ],
    pricing: { tier: "free" },
    releases: [
      { version: "3.1", date: "2024-07-23", features: ["405B parameters", "Extended context"] },
    ],
    officialUrl: "https://llama.meta.com",
    githubUrl: "https://github.com/meta-llama/llama3",
    launchDate: "2024-04-18",
    tags: ["open-source", "self-hosted", "meta"],
  },
  {
    id: "perplexity-pro",
    name: "Perplexity Pro",
    provider: "other",
    category: "search",
    description: "AI-powered search engine with real-time web access and citations",
    capabilities: [
      { name: "Search", description: "Real-time web search", score: 96 },
      { name: "Citations", description: "Source verification", score: 98 },
      { name: "Research", description: "Deep research capabilities", score: 94 },
    ],
    pricing: { tier: "freemium", inputCost: 0, outputCost: 0, currency: "USD" },
    releases: [
      { version: "Pro", date: "2024-01-10", features: ["Enhanced search", "GPT-4 integration"] },
    ],
    officialUrl: "https://perplexity.ai",
    launchDate: "2022-12-07",
    tags: ["search", "research", "citations"],
  },
  {
    id: "cursor-composer",
    name: "Cursor Composer",
    provider: "other",
    category: "code-generation",
    description: "AI-powered code editor with multi-file editing capabilities",
    capabilities: [
      { name: "Multi-file Editing", description: "Edit across codebase", score: 97 },
      { name: "Context Awareness", description: "Full codebase understanding", score: 95 },
      { name: "Developer Experience", description: "Seamless IDE integration", score: 98 },
    ],
    pricing: { tier: "freemium" },
    releases: [
      { version: "0.40", date: "2024-11-15", features: ["Composer v2", "Better context"] },
    ],
    officialUrl: "https://cursor.com",
    launchDate: "2023-03-14",
    tags: ["coding", "ide", "developer-tools"],
  },
  {
    id: "midjourney-v7",
    name: "Midjourney v7",
    provider: "other",
    category: "creative",
    description: "Leading AI image generation with photorealistic quality",
    capabilities: [
      { name: "Image Quality", description: "Photorealistic generation", score: 99 },
      { name: "Style Control", description: "Precise artistic control", score: 96 },
      { name: "Consistency", description: "Character consistency", score: 94 },
    ],
    pricing: { tier: "paid" },
    releases: [
      { version: "7.0", date: "2025-05-12", features: ["Better realism", "Faster generation"] },
    ],
    officialUrl: "https://midjourney.com",
    launchDate: "2022-07-12",
    tags: ["image-generation", "creative", "art"],
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    provider: "openai",
    category: "code-generation",
    description: "AI pair programmer integrated directly into your IDE",
    capabilities: [
      { name: "Code Completion", description: "Context-aware suggestions", score: 94 },
      { name: "IDE Integration", description: "Seamless workflow", score: 99 },
      { name: "Multi-language", description: "Support for many languages", score: 96 },
    ],
    pricing: { tier: "paid" },
    releases: [
      { version: "Chat", date: "2023-09-20", features: ["Conversational coding", "GPT-4 integration"] },
    ],
    officialUrl: "https://github.com/features/copilot",
    githubUrl: "https://github.com/features/copilot",
    launchDate: "2021-06-29",
    tags: ["coding", "ide", "github"],
  },
];

// Generate realistic metrics based on agent characteristics
function generateMetrics(agent: Omit<AIAgent, "metrics" | "lastUpdated">): AIAgentMetrics {
  const baseScore = agent.capabilities.reduce((sum, cap) => sum + cap.score, 0) / agent.capabilities.length;
  const ageFactor = new Date().getTime() - new Date(agent.launchDate).getTime();
  const ageMonths = ageFactor / (1000 * 60 * 60 * 24 * 30);
  
  // New agents trend more
  const isNew = ageMonths < 6;
  
  let velocity: AIAgentMetrics["velocity"] = "stable";
  let trending = false;
  let weeklyChange = Math.random() * 20 - 5; // -5% to +15%
  
  if (isNew || agent.releases[0]?.date && new Date(agent.releases[0].date).getTime() > Date.now() - 90 * 24 * 60 * 60 * 1000) {
    velocity = Math.random() > 0.3 ? "rising" : "peaking";
    trending = Math.random() > 0.4;
    weeklyChange = Math.random() * 40 + 10; // +10% to +50%
  } else if (ageMonths > 18) {
    velocity = Math.random() > 0.7 ? "stable" : "fading";
    weeklyChange = Math.random() * 10 - 3; // -3% to +7%
  }
  
  const mentions = Math.floor((baseScore / 100) * 1000 + Math.random() * 500 + (isNew ? 300 : 0));
  const trend_score = Math.floor(baseScore + (trending ? 20 : 0) - (velocity === "fading" ? 10 : 0));
  
  const sentiments: AIAgentMetrics["sentiment"][] = ["positive", "mixed", "neutral"];
  const sentiment = baseScore > 90 ? "positive" : sentiments[Math.floor(Math.random() * sentiments.length)];
  
  return {
    mentions,
    sentiment,
    velocity,
    trending,
    trend_score: Math.min(100, Math.max(0, trend_score)),
    weekly_change: weeklyChange,
  };
}

export function parseAgentFilter(params: {
  category: string | null;
  provider: string | null;
  trending: string | null;
  minMentions: string | null;
  pricingTier: string | null;
}): AIAgentFilter {
  const filter: AIAgentFilter = {};

  if (params.category) {
    filter.category = params.category as AIAgentCategory;
  }
  if (params.provider) {
    filter.provider = params.provider as AIAgentProvider;
  }
  if (params.trending !== null) {
    filter.trending = params.trending === "true";
  }
  if (params.minMentions) {
    filter.minMentions = parseInt(params.minMentions, 10);
  }
  if (params.pricingTier) {
    filter.pricingTier = params.pricingTier as AIAgentFilter["pricingTier"];
  }

  return filter;
}

export class AIAgentsStore {
  private agents: Map<string, AIAgent> = new Map();
  private trends: Map<string, AIAgentTrend[]> = new Map();
  private lastUpdate: string = new Date().toISOString();

  constructor() {
    this.initializeSeedData();
  }

  private initializeSeedData() {
    const now = new Date().toISOString();
    for (const seedAgent of SEED_AGENTS) {
      const agent: AIAgent = {
        ...seedAgent,
        metrics: generateMetrics(seedAgent),
        lastUpdated: now,
      };
      this.agents.set(agent.id, agent);
    }
  }

  getAll(filter?: AIAgentFilter): AIAgent[] {
    let agents = Array.from(this.agents.values());

    if (filter?.category) {
      agents = agents.filter((a) => a.category === filter.category);
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
    if (filter?.pricingTier) {
      agents = agents.filter((a) => a.pricing.tier === filter.pricingTier);
    }

    return agents.sort((a, b) => b.metrics.trend_score - a.metrics.trend_score);
  }

  getById(id: string): AIAgent | undefined {
    return this.agents.get(id);
  }

  getPayload(filter?: AIAgentFilter): AIAgentsPayload {
    const agents = this.getAll(filter);
    const trends = agents.map((a) => this.getTrends(a.id)).flat();

    const byCategory: Record<string, number> = {};
    const byProvider: Record<string, number> = {};
    
    for (const agent of agents) {
      byCategory[agent.category] = (byCategory[agent.category] || 0) + 1;
      byProvider[agent.provider] = (byProvider[agent.provider] || 0) + 1;
    }

    return {
      agents,
      trends,
      updatedAt: this.lastUpdate,
      metadata: {
        total: agents.length,
        byCategory: byCategory as Record<AIAgentCategory, number>,
        byProvider: byProvider as Record<AIAgentProvider, number>,
        trending: agents.filter((a) => a.metrics.trending).length,
      },
    };
  }

  getTrends(agentId: string): AIAgentTrend[] {
    return this.trends.get(agentId) || [];
  }

  generateInsights(agents: AIAgent[]): AIAgentInsight[] {
    const insights: AIAgentInsight[] = [];

    // Find capability leaders
    const capabilityScores = new Map<string, { agent: string; score: number }[]>();
    for (const agent of agents) {
      for (const cap of agent.capabilities) {
        const scores = capabilityScores.get(cap.name) || [];
        scores.push({ agent: agent.name, score: cap.score });
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
        });
      }
    }

    // Find rising stars
    const rising = agents.filter((a) => a.metrics.velocity === "rising" && a.metrics.weekly_change > 20);
    if (rising.length > 0) {
      insights.push({
        type: "adoption",
        title: "Rising Stars",
        description: `${rising.length} agents showing rapid adoption growth`,
        agents: rising.map((a) => a.name),
        confidence: 0.85,
        evidence: rising.map((a) => `${a.name}: +${a.metrics.weekly_change.toFixed(1)}% weekly`),
      });
    }

    // Innovation insight
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
        title: "Recent Innovations",
        description: `${recentReleases.length} major releases in the last 3 months`,
        agents: recentReleases.map((a) => a.name),
        confidence: 0.95,
        evidence: recentReleases.map((a) => `${a.name}: ${a.releases[0].version}`),
      });
    }

    return insights;
  }

  refresh() {
    this.lastUpdate = new Date().toISOString();
    // Regenerate metrics to simulate real-time updates
    for (const [id, agent] of this.agents) {
      const seedAgent = SEED_AGENTS.find((s) => s.id === id);
      if (seedAgent) {
        agent.metrics = generateMetrics(seedAgent);
        agent.lastUpdated = this.lastUpdate;
      }
    }
  }
}

// Singleton instance
let storeInstance: AIAgentsStore | null = null;

export function getAIAgentsStore(): AIAgentsStore {
  if (!storeInstance) {
    storeInstance = new AIAgentsStore();
  }
  return storeInstance;
}
