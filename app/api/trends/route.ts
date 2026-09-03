import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cachePeek, cacheSet } from "@/lib/cache";
import { attachPublicPosts, attachXPosts, clusterTopics, neighborTopics, plugTopicFromPosts } from "@/lib/cluster";
import {
  collectorAgent,
  collectorSummary,
  healthFrom,
  mergedPublicPosts,
  reviewerAgent,
  validatorAgent,
  whyAgent,
} from "@/lib/agents";
import { geoAgent, trendsCacheKey } from "@/lib/geo";
import { compareExamplePoi } from "@/lib/example-poi-compare";
import { collectExamplePoi } from "@/lib/example-poi";
import { hydrateIndustrySeries } from "@/lib/example-poi-series";
import { locatedReceipts } from "@/lib/trend-geo";
import { enrichQueryIntent, inferQueryIntent, toQueryInsight } from "@/lib/query";
import { recordPulls } from "@/lib/rl";
import { buildSentiment } from "@/lib/sentiment";
import type { TrendsPayload } from "@/lib/types";

export const dynamic = "force-dynamic";
// Hobby (no Fluid) max is 60s. 120 requires Pro and fails the production deploy.
export const maxDuration = 60;

const LAST_KEY = "trends:v1";
const inflight = new Map<string, Promise<TrendsPayload>>();

function markPlatformPulls(sources: TrendsPayload["sources"]) {
  const names = [
    ...(sources.x ? ["X"] : []),
    ...(sources.reddit ? ["Reddit"] : []),
    ...(sources.hn ? ["HN"] : []),
  ];
  if (names.length) recordPulls(names);
}

async function runPipeline(
  geo: ReturnType<typeof geoAgent>,
  cacheKey: string,
  enabledSources?: string[],
) {
  const prev = cachePeek<TrendsPayload>(cacheKey)?.topics;
  const collected = collectorAgent(geo, undefined, enabledSources);
  const [, redditR, hnR, publicR, exampleR] = await Promise.all([
    hydrateIndustrySeries(),
    collected.reddit,
    collected.hn,
    collected.public,
    collectExamplePoi(geo.city),
  ]);

  const [clustered, xR] = await Promise.all([
    clusterTopics(
      {
        reddit: redditR.posts,
        hn: hnR.posts,
        x: [],
        public: [],
        sources: { x: false, reddit: redditR.ok, hn: hnR.ok, public: publicR.ok },
        degraded: [],
      },
      prev,
    ),
    collected.x,
  ]);
  if (xR.ok) attachXPosts(clustered, xR.posts);
  const publicPosts = mergedPublicPosts(xR, publicR);
  if (publicPosts.length) attachPublicPosts(clustered, publicPosts);
  const { sources, degraded } = healthFrom([xR, redditR, hnR, publicR]);
  markPlatformPulls(sources);

  const collectorLog = collectorSummary([xR, redditR, hnR, publicR]);
  const clusterLog = `cluster: ${clustered.length} topics`;
  console.log(clusterLog);

  const validated = validatorAgent(clustered);
  const reviewed = await reviewerAgent(validated.topics);
  const briefed = await whyAgent(reviewed.topics);

  const pipeline = `${geo.log} → ${collectorLog} → ${clusterLog} → ${validated.log} → ${reviewed.log} → ${briefed.log}`;
  console.log(`[pipeline] ${pipeline}`);

  const payload: TrendsPayload = {
    topics: briefed.topics,
    updatedAt: new Date().toISOString(),
    sources,
    degraded,
    pipeline,
    publicApis: publicR.publicApis,
    located: locatedReceipts(publicPosts),
    examplePoi: exampleR.posts,
    poiCompare: compareExamplePoi(exampleR.places, locatedReceipts(publicPosts), {
      collectedAt: exampleR.collectedAt,
      datasetSha: exampleR.datasetSha,
      liveRefresh: exampleR.liveRefresh,
    }),
  };
  cacheSet(cacheKey, payload);
  cacheSet(LAST_KEY, payload);
  console.log(`[trends] ${briefed.topics.length} topics @ ${payload.updatedAt}`);
  return payload;
}

async function runPlug(
  geo: ReturnType<typeof geoAgent>,
  topic: string,
  cacheKey: string,
  enabledSources?: string[],
) {
  const local = inferQueryIntent(topic);
  const intentPromise = enrichQueryIntent(local);
  const collected = collectorAgent(geo, local.search, enabledSources);
  const [, redditR, hnR, xR, publicR, intent, exampleR] = await Promise.all([
    hydrateIndustrySeries(),
    collected.reddit,
    collected.hn,
    collected.x,
    collected.public,
    intentPromise,
    collectExamplePoi(geo.city),
  ]);
  const posts = [...redditR.posts, ...hnR.posts, ...xR.posts, ...mergedPublicPosts(xR, publicR)];
  let clustered = plugTopicFromPosts(topic, posts, intent);
  const used = new Set(clustered.map((t) => t.id));
  const tape = cachePeek<TrendsPayload>(LAST_KEY)?.topics ?? [];
  const neighbors = neighborTopics(topic, intent.aliases, tape).filter((t) => !used.has(t.id));
  if (neighbors.length) clustered = [...clustered, ...neighbors];
  const { sources, degraded } = healthFrom([xR, redditR, hnR, publicR]);
  markPlatformPulls(sources);

  const collectorLog = collectorSummary([xR, redditR, hnR, publicR]);
  const clusterLog = `plug: "${topic}" ${clustered.length} topics from ${posts.length} posts · ${intent.kind}/${intent.category}`;
  console.log(clusterLog);

  const validated = validatorAgent(clustered);
  const pipeline = `${geo.log} → ${collectorLog} → ${clusterLog} → ${validated.log}`;
  console.log(`[pipeline] ${pipeline}`);

  const lead = validated.topics[0] ?? null;
  const sentiment = lead ? buildSentiment(lead) : null;
  const publicPosts = mergedPublicPosts(xR, publicR);
  const payload: TrendsPayload = {
    topics: validated.topics,
    updatedAt: new Date().toISOString(),
    sources,
    degraded,
    pipeline,
    publicApis: publicR.publicApis,
    located: locatedReceipts(publicPosts),
    examplePoi: exampleR.posts,
    poiCompare: compareExamplePoi(exampleR.places, locatedReceipts(publicPosts), {
      collectedAt: exampleR.collectedAt,
      datasetSha: exampleR.datasetSha,
      liveRefresh: exampleR.liveRefresh,
    }),
    plugged: topic,
    query: toQueryInsight(intent, validated.topics, sentiment),
  };
  cacheSet(cacheKey, payload);
  cacheSet(LAST_KEY, payload);
  console.log(`[trends] plugged "${topic}" ${validated.topics.length} topics @ ${payload.updatedAt}`);
  return payload;
}

export async function GET(req: NextRequest) {
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const geo = geoAgent(req.nextUrl.searchParams.get("city"));
  const topic = (req.nextUrl.searchParams.get("topic") ?? "").trim();
  
  // Get enabled sources from query params (comma-separated) or cookie
  let enabledSources: string[] | undefined;
  const sourcesParam = req.nextUrl.searchParams.get("sources");
  const sourcesCookie = req.cookies.get("hawkxai-api-sources")?.value;
  
  if (sourcesParam) {
    enabledSources = sourcesParam.split(",").map((s) => s.trim()).filter(Boolean);
  } else if (sourcesCookie) {
    try {
      const parsed = JSON.parse(sourcesCookie);
      if (Array.isArray(parsed)) {
        enabledSources = parsed.filter((s): s is string => typeof s === "string");
      }
    } catch {
      // Invalid cookie, ignore
    }
  }
  
  console.log(topic ? `${geo.log} topic="${topic}"` : geo.log);
  const cacheKey = trendsCacheKey(geo.city, topic || undefined);

  if (!refresh) {
    const cached = cacheGet<TrendsPayload>(cacheKey);
    if (cached) return NextResponse.json(cached);
    const stale = cachePeek<TrendsPayload>(cacheKey);
    if (stale) return NextResponse.json(stale);
  }

  const existing = inflight.get(cacheKey);
  if (existing && !refresh) {
    return NextResponse.json(await existing);
  }

  const job = (
    topic 
      ? runPlug(geo, topic, cacheKey, enabledSources) 
      : runPipeline(geo, cacheKey, enabledSources)
  ).finally(() => {
    if (inflight.get(cacheKey) === job) inflight.delete(cacheKey);
  });
  inflight.set(cacheKey, job);
  return NextResponse.json(await job);
}
