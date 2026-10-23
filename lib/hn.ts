import { stampPosts } from "./lineage";
import type { Post } from "./types";

export function hnTopUrl(): string {
  return "https://hacker-news.firebaseio.com/v0/topstories.json";
}

export function hnItemUrl(id: number): string {
  return `https://hacker-news.firebaseio.com/v0/item/${id}.json`;
}

export function hnStoryUrl(id: number | string | undefined): string {
  return `https://news.ycombinator.com/item?id=${id}`;
}

interface HnItem {
  id?: number;
  title?: string;
  url?: string;
  score?: number;
  time?: number;
  type?: string;
  dead?: boolean;
  deleted?: boolean;
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function fetchHn(limit = 60): Promise<Post[]> {
  const idsRes = await fetch(hnTopUrl(), { cache: "no-store" });
  if (!idsRes.ok) throw new Error(`hn topstories ${idsRes.status}`);
  const ids = ((await idsRes.json()) as number[]).slice(0, limit);

  const items = await mapPool(ids, 8, async (id) => {
    const res = await fetch(hnItemUrl(id), { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as HnItem;
  });

  const posts = items
    .filter((it): it is HnItem => Boolean(it?.title) && !it?.dead && !it?.deleted)
    .map((it) => ({
      platform: "hn" as const,
      title: it.title ?? "",
      url: it.url ?? hnStoryUrl(it.id),
      score: Number(it.score ?? 0),
      createdAt: new Date((it.time ?? 0) * 1000).toISOString(),
    }));

  console.log(`[hn] ${posts.length} stories`);
  return stampPosts(posts, "collect_hn");
}

export async function searchHn(query: string, limit = 20): Promise<Post[]> {
  const q = query.trim();
  if (!q) return fetchHn(limit);
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=${limit}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`hn search ${res.status}`);
  const data = (await res.json()) as {
    hits?: { title?: string; url?: string; objectID?: string; points?: number; created_at?: string }[];
  };
  const posts = (data.hits ?? [])
    .filter((h) => h.title)
    .map((h) => ({
      platform: "hn" as const,
      title: h.title ?? "",
      url: h.url || hnStoryUrl(h.objectID),
      score: Number(h.points ?? 0),
      createdAt: h.created_at ?? new Date().toISOString(),
    }));
  console.log(`[hn] search "${q}" ${posts.length}`);
  return stampPosts(posts, "collect_hn");
}
