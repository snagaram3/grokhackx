import type {
  AIAgent,
  AIAgentCategory,
  AttentionSource,
  AttentionSourceRecord,
  AIAgentTrendPoint,
} from "./ai-agents-types";

export type SeedAgent = Omit<AIAgent, "metrics" | "lastUpdated" | "categories"> & {
  categories?: AIAgentCategory[];
};

/** Deterministic hash for stable seeded series (no Math.random on cold load). */
export function seedHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededUnit(key: string): number {
  return (seedHash(key) % 10_000) / 10_000;
}

export const SEED_AGENTS: SeedAgent[] = [
  {
    id: "gpt-4",
    name: "GPT-4",
    provider: "openai",
    category: "reasoning",
    categories: ["reasoning", "code-generation", "multimodal"],
    description: "OpenAI flagship reasoning model — tracked for public attention, not vendor claims.",
    capabilities: [
      { name: "Code Generation", description: "Generate high-quality code", score: 95 },
      { name: "Reasoning", description: "Complex problem solving", score: 98 },
      { name: "Multimodal", description: "Text and image understanding", score: 90 },
    ],
    pricing: { tier: "paid", inputCost: 30, outputCost: 60, currency: "USD" },
    releases: [
      { version: "4.0", date: "2023-03-14", features: ["Multimodal input", "Advanced reasoning"], url: "https://openai.com/index/gpt-4-research/" },
      { version: "4-turbo", date: "2023-11-06", features: ["128K context", "Better performance"], url: "https://openai.com/blog/new-models-and-developer-products-announced-at-devday" },
    ],
    searchTerms: ["GPT-4", "GPT4", "OpenAI GPT-4"],
    officialUrl: "https://openai.com/gpt-4",
    docsUrl: "https://platform.openai.com/docs",
    apiUrl: "https://api.openai.com",
    changelogUrl: "https://platform.openai.com/docs/changelog",
    launchDate: "2023-03-14",
    tags: ["reasoning", "multimodal", "production-ready"],
  },
  {
    id: "claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    category: "code-generation",
    categories: ["code-generation", "reasoning", "analysis"],
    description: "Anthropic coding-forward model — attention measured from public discourse.",
    capabilities: [
      { name: "Code Generation", description: "Superior code quality", score: 98 },
      { name: "Analysis", description: "Deep analytical thinking", score: 96 },
      { name: "Safety", description: "Constitutional AI safety", score: 99 },
    ],
    pricing: { tier: "paid", inputCost: 3, outputCost: 15, currency: "USD" },
    releases: [
      { version: "3.5", date: "2024-06-20", features: ["Enhanced coding", "200K context"], url: "https://www.anthropic.com/news/claude-3-5-sonnet" },
    ],
    searchTerms: ["Claude 3.5", "Claude Sonnet", "Anthropic Claude"],
    officialUrl: "https://anthropic.com/claude",
    docsUrl: "https://docs.anthropic.com",
    apiUrl: "https://api.anthropic.com",
    changelogUrl: "https://docs.anthropic.com/en/release-notes/overview",
    launchDate: "2024-06-20",
    tags: ["coding", "safety", "analysis"],
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    category: "multimodal",
    categories: ["multimodal", "code-generation", "search"],
    description: "Google multimodal flash model — this-week attention, not last-month benchmarks.",
    capabilities: [
      { name: "Multimodal", description: "Native multimodal reasoning", score: 97 },
      { name: "Speed", description: "Ultra-fast inference", score: 95 },
      { name: "Code", description: "Strong coding abilities", score: 92 },
    ],
    pricing: { tier: "freemium", inputCost: 0.075, outputCost: 0.3, currency: "USD" },
    releases: [
      { version: "2.0", date: "2024-12-11", features: ["Native multimodal", "2M context"], url: "https://blog.google/technology/google-deepmind/google-gemini-ai-update-december-2024/" },
    ],
    searchTerms: ["Gemini 2.0", "Gemini Flash", "Google Gemini"],
    officialUrl: "https://deepmind.google/gemini",
    docsUrl: "https://ai.google.dev/docs",
    apiUrl: "https://generativelanguage.googleapis.com",
    changelogUrl: "https://ai.google.dev/gemini-api/docs/changelog",
    launchDate: "2024-12-11",
    tags: ["multimodal", "fast", "google"],
  },
  {
    id: "llama-3",
    name: "Llama 3",
    provider: "meta",
    category: "automation",
    categories: ["automation", "code-generation"],
    description: "Meta open-weight family — public chatter and GitHub signal, not download claims.",
    capabilities: [
      { name: "Open Source", description: "Free to use and modify", score: 100 },
      { name: "Performance", description: "Strong general capabilities", score: 88 },
      { name: "Deployment", description: "Self-hosted flexibility", score: 95 },
    ],
    pricing: { tier: "free" },
    releases: [
      { version: "3.1", date: "2024-07-23", features: ["405B parameters", "Extended context"], url: "https://ai.meta.com/blog/meta-llama-3-1/" },
    ],
    searchTerms: ["Llama 3", "Llama3", "Meta Llama"],
    officialUrl: "https://llama.meta.com",
    githubUrl: "https://github.com/meta-llama/llama3",
    changelogUrl: "https://github.com/meta-llama/llama3/releases",
    launchDate: "2024-04-18",
    tags: ["open-source", "self-hosted", "meta"],
  },
  {
    id: "perplexity-pro",
    name: "Perplexity Pro",
    provider: "other",
    category: "search",
    categories: ["search", "analysis"],
    description: "Search-native assistant — tracked where engineers discuss build targets.",
    capabilities: [
      { name: "Search", description: "Real-time web search", score: 96 },
      { name: "Citations", description: "Source verification", score: 98 },
      { name: "Research", description: "Deep research capabilities", score: 94 },
    ],
    pricing: { tier: "freemium", inputCost: 0, outputCost: 0, currency: "USD" },
    releases: [
      { version: "Pro", date: "2024-01-10", features: ["Enhanced search", "GPT-4 integration"], url: "https://www.perplexity.ai/" },
    ],
    searchTerms: ["Perplexity AI", "Perplexity Pro"],
    officialUrl: "https://perplexity.ai",
    launchDate: "2022-12-07",
    tags: ["search", "research", "citations"],
  },
  {
    id: "cursor-composer",
    name: "Cursor Composer",
    provider: "other",
    category: "code-generation",
    categories: ["code-generation", "automation"],
    description: "Agentic IDE surface — attention from builders choosing an editor stack.",
    capabilities: [
      { name: "Multi-file Editing", description: "Edit across codebase", score: 97 },
      { name: "Context Awareness", description: "Full codebase understanding", score: 95 },
      { name: "Developer Experience", description: "Seamless IDE integration", score: 98 },
    ],
    pricing: { tier: "freemium" },
    releases: [
      { version: "0.40", date: "2024-11-15", features: ["Composer v2", "Better context"], url: "https://cursor.com/changelog" },
    ],
    searchTerms: ["Cursor AI", "Cursor Composer", "Cursor IDE"],
    officialUrl: "https://cursor.com",
    changelogUrl: "https://cursor.com/changelog",
    launchDate: "2023-03-14",
    tags: ["coding", "ide", "developer-tools"],
  },
  {
    id: "midjourney-v7",
    name: "Midjourney v7",
    provider: "other",
    category: "creative",
    categories: ["creative", "multimodal"],
    description: "Image generation leader — creative attention, separate from coding stacks.",
    capabilities: [
      { name: "Image Quality", description: "Photorealistic generation", score: 99 },
      { name: "Style Control", description: "Precise artistic control", score: 96 },
      { name: "Consistency", description: "Character consistency", score: 94 },
    ],
    pricing: { tier: "paid" },
    releases: [
      { version: "7.0", date: "2025-05-12", features: ["Better realism", "Faster generation"], url: "https://docs.midjourney.com/" },
    ],
    searchTerms: ["Midjourney", "Midjourney v7"],
    officialUrl: "https://midjourney.com",
    launchDate: "2022-07-12",
    tags: ["image-generation", "creative", "art"],
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    provider: "openai",
    category: "code-generation",
    categories: ["code-generation", "enterprise"],
    description: "IDE pair-programmer — enterprise attention and GitHub discourse.",
    capabilities: [
      { name: "Code Completion", description: "Context-aware suggestions", score: 94 },
      { name: "IDE Integration", description: "Seamless workflow", score: 99 },
      { name: "Multi-language", description: "Support for many languages", score: 96 },
    ],
    pricing: { tier: "paid", inputCost: 0, outputCost: 0, currency: "USD" },
    releases: [
      { version: "Chat", date: "2023-09-20", features: ["Conversational coding", "GPT-4 integration"], url: "https://github.blog/2023-09-20-github-copilot-chat-beta-now-available-for-individuals/" },
    ],
    searchTerms: ["GitHub Copilot", "Copilot Chat"],
    officialUrl: "https://github.com/features/copilot",
    githubUrl: "https://github.com/features/copilot",
    changelogUrl: "https://github.blog/changelog/",
    launchDate: "2021-06-29",
    tags: ["coding", "ide", "github"],
  },
];

const PLATFORM_CYCLE: AttentionSource[] = ["hn", "reddit", "x", "github", "changelog"];

const SAMPLE_TITLES: Record<string, string[]> = {
  "gpt-4": [
    "GPT-4 still the default for production reasoning workloads",
    "Devs debating GPT-4 vs Claude for long-context agents",
    "OpenAI changelog: GPT-4 Turbo pricing and context notes",
  ],
  "claude-3.5-sonnet": [
    "Claude 3.5 Sonnet dominating coding agent threads this week",
    "Anthropic release notes: Sonnet coding improvements",
    "Side-by-side: Sonnet vs Copilot for multi-file refactors",
  ],
  "gemini-2.0-flash": [
    "Gemini 2.0 Flash spikes after multimodal demo posts",
    "Google AI changelog: Flash latency and context updates",
    "Builders testing Gemini Flash as a cheap agent router",
  ],
  "llama-3": [
    "Llama 3 self-host threads on HN and Reddit",
    "meta-llama/llama3 release chatter and fine-tune recipes",
    "Open-weight attention rising for on-prem agent stacks",
  ],
  "perplexity-pro": [
    "Perplexity Pro as research front-end for eng leaders",
    "Citation workflow debates around Perplexity vs custom RAG",
    "Search-agent attention: Perplexity mentions climb",
  ],
  "cursor-composer": [
    "Cursor Composer multi-file edits — this week's builder chatter",
    "Cursor changelog: Composer context improvements",
    "Engineering teams comparing Cursor vs Copilot agents",
  ],
  "midjourney-v7": [
    "Midjourney v7 quality posts surge on creative subs",
    "Creative teams picking Midjourney over open image models",
    "Midjourney docs update and style-consistency threads",
  ],
  "github-copilot": [
    "GitHub Copilot enterprise rollouts in eng leader forums",
    "Copilot Chat vs Cursor for agentic IDE workflows",
    "GitHub changelog: Copilot feature drops this week",
  ],
};

function dayIso(daysAgo: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function sourceUrl(platform: AttentionSource, agentId: string, i: number): string {
  const q = encodeURIComponent(agentId);
  switch (platform) {
    case "hn":
      return `https://news.ycombinator.com/item?id=seed-${agentId}-${i}`;
    case "reddit":
      return `https://www.reddit.com/r/MachineLearning/comments/seed_${agentId}_${i}/`;
    case "x":
      return `https://x.com/search?q=${q}&src=hawkxai_seed`;
    case "github":
      return `https://github.com/search?q=${q}&type=repositories`;
    case "changelog":
      return SEED_AGENTS.find((a) => a.id === agentId)?.changelogUrl
        || SEED_AGENTS.find((a) => a.id === agentId)?.officialUrl
        || `https://example.com/changelog/${agentId}`;
    default:
      return `https://example.com/source/${agentId}/${i}`;
  }
}

/** 14-day deterministic mention series per agent. */
export function buildSeedTrendSeries(agentId: string, days = 14): AIAgentTrendPoint[] {
  const base = 40 + (seedHash(agentId) % 80);
  const points: AIAgentTrendPoint[] = [];
  for (let ago = days - 1; ago >= 0; ago--) {
    const wobble = Math.sin((seedHash(`${agentId}:${ago}`) % 360) * (Math.PI / 180)) * 18;
    const ramp = ago < 7 ? (7 - ago) * (2 + seededUnit(`${agentId}:ramp`) * 6) : 0;
    const mentions = Math.max(5, Math.round(base + wobble + ramp));
    const platforms: Partial<Record<AttentionSource, number>> = {};
    let remaining = mentions;
    for (let p = 0; p < PLATFORM_CYCLE.length; p++) {
      const share = p === PLATFORM_CYCLE.length - 1
        ? remaining
        : Math.max(0, Math.round(mentions * (0.12 + seededUnit(`${agentId}:${ago}:${p}`) * 0.2)));
      platforms[PLATFORM_CYCLE[p]] = Math.min(remaining, share);
      remaining -= platforms[PLATFORM_CYCLE[p]]!;
    }
    points.push({
      agentId,
      date: dayIso(ago),
      mentions,
      platforms,
    });
  }
  return points;
}

export function windowMentions(series: AIAgentTrendPoint[], startDayAgo: number, endDayAgo: number): number {
  const start = dayIso(startDayAgo);
  const end = dayIso(endDayAgo);
  return series
    .filter((p) => p.date >= end && p.date <= start)
    .reduce((sum, p) => sum + p.mentions, 0);
}

export function platformSharesForWindow(
  series: AIAgentTrendPoint[],
  startDayAgo: number,
  endDayAgo: number,
): Partial<Record<AttentionSource, number>> {
  const start = dayIso(startDayAgo);
  const end = dayIso(endDayAgo);
  const shares: Partial<Record<AttentionSource, number>> = {};
  for (const p of series) {
    if (p.date < end || p.date > start) continue;
    for (const [plat, n] of Object.entries(p.platforms)) {
      shares[plat as AttentionSource] = (shares[plat as AttentionSource] || 0) + (n || 0);
    }
  }
  return shares;
}

export function buildSeedSources(agent: SeedAgent, series: AIAgentTrendPoint[]): AttentionSourceRecord[] {
  const collectedAt = new Date().toISOString();
  const titles = SAMPLE_TITLES[agent.id] || [`Public mention of ${agent.name}`];
  const records: AttentionSourceRecord[] = [];
  const recent = series.slice(-7);
  let i = 0;
  for (const point of recent) {
    for (const platform of PLATFORM_CYCLE) {
      const count = point.platforms[platform] || 0;
      if (count <= 0) continue;
      const title = titles[i % titles.length];
      records.push({
        id: `${agent.id}:${platform}:${point.date}:${i}`,
        agentId: agent.id,
        platform,
        title: `${title} (${point.date})`,
        url: sourceUrl(platform, agent.id, i),
        score: Math.max(1, Math.round(count / 3)),
        createdAt: `${point.date}T15:00:00.000Z`,
        tool: `ai_agents_seed_${platform}`,
        collectedAt,
        metric: "mentions",
      });
      i += 1;
      if (records.length >= 12) return records;
    }
  }
  // Changelog receipt always present for traceability
  if (agent.changelogUrl || agent.releases[0]?.url) {
    records.push({
      id: `${agent.id}:changelog:seed`,
      agentId: agent.id,
      platform: "changelog",
      title: `${agent.name} provider changelog / release note`,
      url: agent.releases[0]?.url || agent.changelogUrl!,
      score: 1,
      createdAt: collectedAt,
      tool: "ai_agents_seed_changelog",
      collectedAt,
      metric: "attention",
    });
  }
  return records;
}

export function withCategories(agent: SeedAgent): Omit<AIAgent, "metrics" | "lastUpdated"> {
  return {
    ...agent,
    categories: agent.categories?.length ? agent.categories : [agent.category],
  };
}
