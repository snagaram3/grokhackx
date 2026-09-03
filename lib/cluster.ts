import { geminiJson, hasGoogleKey } from "./gemini";
import { clusteredListSchema } from "./schemas";
import {
  divergenceOf,
  peakHourCT,
  scalePosts,
  singletonTopics,
  slug,
  totalScore,
  velocityOf,
} from "./metrics";
import { needlesOf, titleHits, titleScore, type QueryIntent } from "./query";
import { tokenHits } from "./phrase-hit";
import { topicBoost } from "./rl";
import { PLATFORMS, type Platform, type Post, type RawSignals, type Topic } from "./types";

function compact(posts: Post[], n: number) {
  return [...posts]
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((p, i) => ({ i, title: p.title.slice(0, 140), score: p.score }));
}

function empty() {
  return { score: 0, posts: [] as Post[] };
}

function hydrate(
  label: string,
  buckets: Record<Platform, Post[]>,
  match?: Topic["match"],
): Topic {
  const platforms = {
    x: empty(),
    reddit: empty(),
    hn: empty(),
    public: empty(),
  };
  for (const p of PLATFORMS) {
    const posts = (buckets[p] ?? []).slice(0, 5);
    platforms[p] = {
      posts,
      score: p === "x" ? (posts[0]?.score ?? 0) : scalePosts(posts),
    };
  }
  const all = PLATFORMS.flatMap((p) => platforms[p].posts);
  return {
    id: slug(label),
    label,
    platforms,
    velocity: "peaking",
    divergence: divergenceOf({ platforms }),
    peakHourCT: peakHourCT(all),
    tickers: [],
    match,
  };
}

export async function clusterTopics(
  signals: RawSignals,
  prev?: Topic[],
): Promise<Topic[]> {
  const reddit = compact(signals.reddit, 25);
  const hn = compact(signals.hn, 25);
  const x = compact(signals.x, 15);
  const all = {
    reddit: signals.reddit,
    hn: signals.hn,
    x: signals.x,
    public: signals.public ?? [],
  };

  if (!hasGoogleKey()) {
    return singletonTopics([
      ...signals.reddit,
      ...signals.hn,
      ...signals.x,
      ...(signals.public ?? []),
    ]);
  }

  try {
    const parsed = await geminiJson(
      `Group these posts into 12-20 cross-platform topics.
Use only the provided items. Empty posts arrays are allowed.
Return strict JSON:
{"topics":[{"id":"slug","label":"phrase","platforms":{"x":{"score":0,"posts":[]},"reddit":{"score":0,"posts":[]},"hn":{"score":0,"posts":[]}}}]}
posts items must be {platform,title,url,score,createdAt} copied from inputs when possible.

X: ${JSON.stringify(x)}
Reddit: ${JSON.stringify(reddit)}
HN: ${JSON.stringify(hn)}`,
      (raw) => clusteredListSchema.parse(JSON.parse(raw)),
    );

    const topics = parsed.topics.map((t) => {
      const buckets: Record<Platform, Post[]> = { x: [], reddit: [], hn: [], public: [] };
      for (const p of PLATFORMS) {
        const fromModel = t.platforms[p].posts;
        buckets[p] = fromModel
          .map((fp) =>
            all[p].find(
              (rp) =>
                rp.url === fp.url ||
                rp.title.toLowerCase() === fp.title.toLowerCase(),
            ),
          )
          .filter((x): x is Post => Boolean(x));
        if (!buckets[p].length) {
          const idxs = fromModel
            .map((fp) => reddit.find((r) => r.title === fp.title)?.i)
            .filter((n): n is number => n !== undefined);
          if (p === "reddit") {
            buckets[p] = idxs.map((i) => all.reddit[i]).filter(Boolean);
          }
        }
      }
      const topic = hydrate(t.label, buckets);
      const score = totalScore(topic);
      topic.velocity = velocityOf(topic.id, score, prev);
      return topic;
    });
    console.log(`[cluster] gemini grouped ${topics.length} topics`);
    return topics;
  } catch (err) {
    console.error("[cluster] falling back to singletons", err);
    return singletonTopics([
      ...signals.reddit,
      ...signals.hn,
      ...signals.x,
      ...(signals.public ?? []),
    ]);
  }
}

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3),
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const t of a) if (b.has(t)) n += 1;
  return n / Math.min(a.size, b.size);
}

function matchesQuery(title: string, query: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return false;
  if (tokenHits(title, q)) return true;
  const qTok = new Set(q.split(/[^a-z0-9]+/).filter((w) => w.length > 1));
  if ([...qTok].some((w) => w.length > 2 && tokenHits(title, w))) return true;
  return overlap(qTok, tokens(title)) >= 0.18;
}

function bucketPosts(posts: Post[], needles: string[], query: string): Record<Platform, Post[]> {
  const buckets: Record<Platform, Post[]> = { x: [], reddit: [], hn: [], public: [] };
  for (const p of posts) {
    if (titleHits(p.title, needles) || matchesQuery(p.title, query)) buckets[p.platform].push(p);
  }
  return buckets;
}

function hitCountOf(buckets: Record<Platform, Post[]>): number {
  return PLATFORMS.reduce((n, p) => n + buckets[p].length, 0);
}

/** Closest leftover receipts — never dump unrelated posts as if they matched. */
function nearBuckets(posts: Post[], needles: string[]): Record<Platform, Post[]> {
  const ranked = [...posts]
    .map((p) => ({ p, s: titleScore(p.title, needles) }))
    .filter((x) => x.s >= 1.2)
    .toSorted((a, b) => b.s - a.s)
    .slice(0, 16);
  const buckets: Record<Platform, Post[]> = { x: [], reddit: [], hn: [], public: [] };
  for (const { p } of ranked) buckets[p.platform].push(p);
  return buckets;
}

export function neighborTopics(query: string, aliases: string[], tape: Topic[]): Topic[] {
  const needles = needlesOf({ raw: query, aliases });
  return tape
    .filter((t) => titleHits(t.label, needles) || matchesQuery(t.label, query))
    .slice(0, 8)
    .map((t) => ({ ...t, match: "neighbor" as const }));
}

/** Build a desk-ready topic from any query + live posts. No invented WHY. */
export function plugTopicFromPosts(query: string, posts: Post[], intent?: QueryIntent): Topic[] {
  const label = query.trim() || "topic";
  const needles = needlesOf({ raw: label, aliases: intent?.aliases ?? [] });
  let buckets = bucketPosts(posts, needles, label);
  let match: Topic["match"] = "exact";
  if (hitCountOf(buckets) === 0) {
    buckets = nearBuckets(posts, needles);
    match = hitCountOf(buckets) > 0 ? "near" : "neighbor";
  }
  const topic = hydrate(label, buckets, match);
  topic.platforms.public.posts = buckets.public.slice(0, 12);
  const apis = topic.platforms.public.posts.flatMap((p) => (p.sourceApi ? [p.sourceApi] : []));
  topic.platforms.public.score = Math.round(scalePosts(buckets.public) * topicBoost(apis));
  topic.divergence = divergenceOf(topic);

  const usedTitles = new Set(PLATFORMS.flatMap((p) => buckets[p].map((x) => x.title)));
  const leftover = posts
    .filter((p) => !usedTitles.has(p.title))
    .map((p) => ({ p, s: titleScore(p.title, needles) }))
    .filter((x) => x.s >= 1.4)
    .toSorted((a, b) => b.s - a.s)
    .slice(0, 12);

  const topics: Topic[] = [topic];
  const used = new Set(topics.map((t) => t.id));
  for (const { p } of leftover) {
    const extra = hydrate(p.title, {
      x: p.platform === "x" ? [p] : [],
      reddit: p.platform === "reddit" ? [p] : [],
      hn: p.platform === "hn" ? [p] : [],
      public: p.platform === "public" ? [p] : [],
    }, "near");
    if (used.has(extra.id)) continue;
    used.add(extra.id);
    topics.push(extra);
  }
  return topics;
}

/** Attach X topics after clustering so Google Search can run in parallel with Gemini. */
export function attachXPosts(topics: Topic[], xPosts: Post[]): Topic[] {
  if (!xPosts.length) return topics;
  const used = new Set<string>();
  for (const topic of topics) {
    const labelTok = tokens(topic.label);
    const matched = xPosts.filter(
      (p) => !used.has(p.title) && overlap(labelTok, tokens(p.title)) >= 0.25,
    );
    for (const p of matched) used.add(p.title);
    if (!matched.length) continue;
    topic.platforms.x.posts = matched.slice(0, 5);
    topic.platforms.x.score = matched[0]?.score ?? 0;
    topic.divergence = divergenceOf(topic);
  }
  for (const p of xPosts) {
    if (used.has(p.title)) continue;
    topics.push(hydrate(p.title, { x: [p], reddit: [], hn: [], public: [] }));
    used.add(p.title);
  }
  return topics;
}

/** Attach public-apis receipts after clustering so Gemini is not blocked on 20+ feeds. */
export function attachPublicPosts(topics: Topic[], publicPosts: Post[]): Topic[] {
  if (!publicPosts.length) return topics;
  const used = new Set<string>();
  for (const topic of topics) {
    const labelTok = tokens(topic.label);
    const matched = publicPosts.filter(
      (p) => !used.has(p.title) && overlap(labelTok, tokens(p.title)) >= 0.22,
    );
    for (const p of matched) used.add(p.title);
    if (!matched.length) continue;
    topic.platforms.public.posts = matched.slice(0, 5);
    topic.platforms.public.score = Math.round(
      scalePosts(matched) * topicBoost(matched.flatMap((p) => (p.sourceApi ? [p.sourceApi] : []))),
    );
    topic.divergence = divergenceOf(topic);
  }
  const leftover = publicPosts
    .filter((p) => !used.has(p.title))
    .toSorted((a, b) => b.score - a.score)
    .slice(0, 24);
  for (const p of leftover) {
    const topic = hydrate(p.title, { x: [], reddit: [], hn: [], public: [p] });
    // Keep leftover public singletons unique — NWS titles share a long prefix,
    // and slug() would otherwise keep the shared head of source+url.
    const src = (p.sourceApi || p.platform).replace(/\s+/g, "").slice(0, 8);
    const tail = p.url.replace(/^https?:\/\//i, "").slice(-28);
    topic.id = slug(`${src}-${tail}`) || topic.id;
    topics.push(topic);
  }
  return topics;
}
