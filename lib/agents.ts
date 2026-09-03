import { fetchHn, searchHn } from "./hn";
import { fetchReddit, searchReddit } from "./reddit";
import { collectPublicApis } from "./public-apis";
import { fetchGoogleTrendsSafe, fetchX } from "./signals";
import { geminiChat, hasGoogleKey } from "./gemini";
import { divergenceOf } from "./metrics";
import { geoAgent, type GeoQuery } from "./geo";
import { whyListSchema } from "./schemas";
import {
  PLATFORMS,
  type Platform,
  type Post,
  type PublicApiIngest,
  type SourceHealth,
  type Topic,
} from "./types";

export type SourceName = Platform;

export interface SourceResult {
  source: SourceName;
  ok: boolean;
  count: number;
  posts: Post[];
  publicApis?: PublicApiIngest;
  /** When X is empty, Google Trends RSS receipts land here — never stamped as X. */
  fallback?: string;
  fallbackPosts?: Post[];
}

function fmt(r: SourceResult): string {
  const extra =
    r.fallback && (r.fallbackPosts?.length ?? 0) > 0
      ? ` ${r.fallback}(${r.fallbackPosts!.length})`
      : "";
  return `${r.source} ${r.ok ? "ok" : "fail"}(${r.count})${extra}`;
}

export function mergedPublicPosts(xR: SourceResult, publicR: SourceResult): Post[] {
  return [...publicR.posts, ...(xR.fallbackPosts ?? [])];
}

async function collectSource(
  source: SourceName,
  run: () => Promise<Post[]>,
): Promise<SourceResult> {
  try {
    const posts = await run();
    const result: SourceResult = {
      source,
      ok: posts.length > 0,
      count: posts.length,
      posts,
    };
    console.log(`collector: ${fmt(result)}`);
    return result;
  } catch (err) {
    console.error(`collector: ${source} fail(0)`, err);
    return { source, ok: false, count: 0, posts: [] };
  }
}

async function collectPublicSource(
  city: GeoQuery["city"],
  topic?: string,
  enabledSources?: string[],
): Promise<SourceResult> {
  try {
    const { posts, ingest } = await collectPublicApis(city, topic, enabledSources);
    const result: SourceResult = {
      source: "public",
      ok: posts.length > 0,
      count: posts.length,
      posts,
      publicApis: ingest,
    };
    console.log(`collector: ${fmt(result)}`);
    return result;
  } catch (err) {
    console.error("collector: public fail(0)", err);
    return { source: "public", ok: false, count: 0, posts: [] };
  }
}

/** Parallel X / Reddit / HN / public-apis fetchers. Optional topic searches each source. */
export function collectorAgent(
  geo: GeoQuery = geoAgent("all"),
  topic?: string,
  enabledSources?: string[],
): {
  reddit: Promise<SourceResult>;
  hn: Promise<SourceResult>;
  x: Promise<SourceResult>;
  public: Promise<SourceResult>;
} {
  const q = topic?.trim() || undefined;
  return {
    reddit: collectSource("reddit", () => (q ? searchReddit(q) : fetchReddit(geo.redditSubs))),
    hn: collectSource("hn", () => (q ? searchHn(q) : fetchHn())),
    public: collectPublicSource(geo.city, q, enabledSources),
    x: collectXSource(geo, q),
  };
}

async function collectXSource(geo: GeoQuery, q?: string): Promise<SourceResult> {
  let xPosts: Post[] = [];
  if (hasGoogleKey()) {
    try {
      xPosts = await fetchX(geo.label ?? undefined, q);
    } catch (err) {
      console.error("collector: x fail(0)", err);
    }
  }
  if (xPosts.length) {
    const result: SourceResult = { source: "x", ok: true, count: xPosts.length, posts: xPosts };
    console.log(`collector: ${fmt(result)}`);
    return result;
  }
  const trends = await fetchGoogleTrendsSafe(geo.city, q);
  const result: SourceResult = {
    source: "x",
    ok: false,
    count: 0,
    posts: [],
    fallback: trends.length ? "google trends" : undefined,
    fallbackPosts: trends.length ? trends : undefined,
  };
  console.log(`collector: ${fmt(result)}`);
  return result;
}

export function collectorSummary(parts: SourceResult[]): string {
  return `collector: ${parts.map(fmt).join(" ")}`;
}

export function healthFrom(results: SourceResult[]): {
  sources: SourceHealth;
  degraded: string[];
} {
  const sources: SourceHealth = { x: false, reddit: false, hn: false, public: false };
  const degraded: string[] = [];
  for (const r of results) {
    sources[r.source] = r.ok;
    if (r.ok) continue;
    if (r.fallback && (r.fallbackPosts?.length ?? 0) > 0) {
      degraded.push(`${r.source} offline · ${r.fallback} fallback`);
      sources.public = true;
    } else {
      degraded.push(`${r.source} offline`);
    }
  }
  return { sources, degraded };
}

function validUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Pure-code pass after clustering. Never fails the request. */
export function validatorAgent(topics: Topic[]): {
  topics: Topic[];
  droppedTopics: number;
  droppedPosts: number;
  log: string;
} {
  let droppedPosts = 0;
  let droppedTopics = 0;
  const seen = new Set<string>();
  const out: Topic[] = [];

  for (const topic of topics) {
    const platforms = { ...topic.platforms };
    for (const p of PLATFORMS) {
      const slice = topic.platforms[p] ?? { score: 0, posts: [] as Post[] };
      const kept = slice.posts.filter((post) => {
        if (!post.url || !validUrl(post.url)) {
          droppedPosts += 1;
          return false;
        }
        return true;
      });
      platforms[p] = {
        posts: kept,
        score: Math.max(0, Math.min(100, slice.score)),
      };
    }
    const n = PLATFORMS.reduce((s, p) => s + platforms[p].posts.length, 0);
    if (n === 0) {
      droppedTopics += 1;
      continue;
    }
    const key = topic.label.trim().toLowerCase();
    if (seen.has(key)) {
      droppedTopics += 1;
      continue;
    }
    seen.add(key);
    const next = { ...topic, platforms, divergence: divergenceOf({ platforms }) };
    out.push(next);
  }

  const log = `validator: -${droppedTopics} topics, -${droppedPosts} posts`;
  console.log(log);
  return { topics: out, droppedTopics, droppedPosts, log };
}

function parseJsonObject(raw: string): unknown {
  const t = raw.trim();
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1));
    throw new Error("no json object");
  }
}

/** Advisory Gemini pass. 15s cap. Failure skips silently. */
export async function reviewerAgent(topics: Topic[]): Promise<{
  topics: Topic[];
  log: string;
}> {
  if (!hasGoogleKey() || topics.length === 0) {
    return { topics, log: "reviewer: skipped" };
  }
  try {
    const raw = await geminiChat(
      `Flag any topic that looks like spam, a duplicate, or not a real trend.
Return JSON only: {"remove":[{"id":"","reason":"one line"}]}
If none, {"remove":[]}.
Topics: ${JSON.stringify(topics.map((t) => ({ id: t.id, label: t.label })))}`,
      15_000,
    );
    const parsed = parseJsonObject(raw) as {
      remove?: { id?: string; reason?: string }[];
    };
    const remove = (parsed.remove ?? []).filter((r) => r.id);
    if (!remove.length) {
      const log = "reviewer: -0";
      console.log(log);
      return { topics, log };
    }
    const ids = new Set(remove.map((r) => r.id as string));
    const kept = topics.filter((t) => !ids.has(t.id));
    const reasons = remove
      .map((r) => r.reason?.slice(0, 40) || "flagged")
      .slice(0, 3)
      .join("; ");
    const log = `reviewer: -${remove.length} (${reasons})`;
    console.log(log);
    for (const r of remove) {
      console.log(`reviewer: drop ${r.id} — ${r.reason ?? ""}`);
    }
    return { topics: kept.length ? kept : topics, log };
  } catch {
    console.log("reviewer: skipped");
    return { topics, log: "reviewer: skipped" };
  }
}

/** One Gemini briefing per topic. Skip silently if it fails. */
export async function whyAgent(topics: Topic[]): Promise<{
  topics: Topic[];
  log: string;
}> {
  if (!hasGoogleKey() || topics.length === 0) {
    return { topics, log: "why: skipped" };
  }
  try {
    const compact = topics.slice(0, 20).map((t) => ({
      id: t.id,
      label: t.label,
      posts: Object.values(t.platforms)
        .flatMap((s) => s.posts.map((p) => p.title))
        .slice(0, 2),
    }));
    const raw = await geminiChat(
      `For each topic, write one sentence on why it is trending, grounded only in the post titles.
No hype. No tickers. No advice. If you cannot tell, omit that id.
JSON only: {"why":[{"id":"slug","why":"one sentence"}]}
Topics: ${JSON.stringify(compact)}`,
      20_000,
    );
    const parsed = whyListSchema.parse(parseJsonObject(raw));
    const byId = new Map(parsed.why.map((w) => [w.id, w.why.trim()]));
    let n = 0;
    for (const topic of topics) {
      const sentence = byId.get(topic.id);
      if (!sentence) continue;
      topic.why = sentence.slice(0, 240);
      n += 1;
    }
    const log = `why: ${n}`;
    console.log(log);
    return { topics, log };
  } catch {
    console.log("why: skipped");
    return { topics, log: "why: skipped" };
  }
}
