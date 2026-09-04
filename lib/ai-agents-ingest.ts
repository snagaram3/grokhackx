import { stampPosts } from "./lineage";
import { searchHn } from "./hn";
import { searchReddit } from "./reddit";
import type { Post } from "./types";
import type { AttentionSource, AttentionSourceRecord } from "./ai-agents-types";
import type { SeedAgent } from "./ai-agents-seed";

function mapPlatform(p: Post["platform"]): AttentionSource {
  if (p === "hn" || p === "reddit" || p === "x" || p === "public") return p === "public" ? "github" : p;
  return "public";
}

function toRecord(agentId: string, post: Post, tool: string): AttentionSourceRecord {
  return {
    id: `${agentId}:${post.platform}:${encodeURIComponent(post.url).slice(0, 80)}`,
    agentId,
    platform: mapPlatform(post.platform),
    title: post.title,
    url: post.url,
    score: post.score,
    createdAt: post.createdAt,
    tool: post.tool ?? tool,
    collectedAt: post.collectedAt ?? new Date().toISOString(),
    metric: "mentions",
  };
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Live public ingest for one agent. Never throws — returns [] on failure. */
export async function ingestAgentMentions(
  agent: SeedAgent,
  opts: { limitPerSource?: number; timeoutMs?: number } = {},
): Promise<AttentionSourceRecord[]> {
  const limit = opts.limitPerSource ?? 8;
  const timeoutMs = opts.timeoutMs ?? 4500;
  const term = agent.searchTerms[0] || agent.name;
  const records: AttentionSourceRecord[] = [];

  const [hn, reddit] = await Promise.all([
    withTimeout(searchHn(term, limit).catch(() => [] as Post[]), timeoutMs),
    withTimeout(searchReddit(term).catch(() => [] as Post[]), timeoutMs),
  ]);

  if (hn?.length) {
    for (const post of stampPosts(hn, "ai_agents_collect_hn")) {
      records.push(toRecord(agent.id, post, "ai_agents_collect_hn"));
    }
  }
  if (reddit?.length) {
    for (const post of stampPosts(reddit.slice(0, limit), "ai_agents_collect_reddit")) {
      records.push(toRecord(agent.id, post, "ai_agents_collect_reddit"));
    }
  }

  // Changelog / GitHub as static live receipts when URLs exist
  const collectedAt = new Date().toISOString();
  if (agent.changelogUrl) {
    records.push({
      id: `${agent.id}:changelog:live`,
      agentId: agent.id,
      platform: "changelog",
      title: `${agent.name} changelog`,
      url: agent.changelogUrl,
      score: 1,
      createdAt: collectedAt,
      tool: "ai_agents_collect_changelog",
      collectedAt,
      metric: "attention",
    });
  }
  if (agent.githubUrl) {
    records.push({
      id: `${agent.id}:github:live`,
      agentId: agent.id,
      platform: "github",
      title: `${agent.name} GitHub presence`,
      url: agent.githubUrl,
      score: 1,
      createdAt: collectedAt,
      tool: "ai_agents_collect_github",
      collectedAt,
      metric: "mentions",
    });
  }

  return records;
}

export async function ingestAllAgents(
  agents: SeedAgent[],
  opts?: { limitPerSource?: number; timeoutMs?: number },
): Promise<{ records: AttentionSourceRecord[]; liveAgentIds: string[] }> {
  const results = await Promise.all(
    agents.map(async (agent) => {
      const records = await ingestAgentMentions(agent, opts);
      return { agentId: agent.id, records };
    }),
  );
  const records = results.flatMap((r) => r.records);
  const liveAgentIds = results.filter((r) => r.records.some((x) => x.tool.includes("collect"))).map((r) => r.agentId);
  return { records, liveAgentIds };
}
