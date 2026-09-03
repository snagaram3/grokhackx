import { geminiJson } from "./gemini";
import { CITIES, type CityId } from "./geo";
import { stampPosts } from "./lineage";
import { tokenHits } from "./phrase-hit";
import { xTrendListSchema } from "./schemas";
import type { Post } from "./types";

const TRENDS_UA = "HawkxAI/1.0 (campaign footprint; receipts only)";
const WORLD_TRENDS_GEOS = ["US", "GB", "IN", "JP", "BR"] as const;

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

export function isGoogleTrendsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "trends.google.com") return true;
    return host === "google.com" && u.pathname.toLowerCase().startsWith("/trends");
  } catch {
    return false;
  }
}

export function trendsRssGeos(city: CityId = "all"): string[] {
  if (city !== "all" && city in CITIES) return [CITIES[city].yt];
  return [...WORLD_TRENDS_GEOS];
}

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function firstHref(chunk: string): string {
  const hrefs = [
    chunk.match(/<link[^>]*href="([^"]+)"/i)?.[1],
    chunk.match(/<link[^>]*>([^<]+)<\/link>/i)?.[1],
    chunk.match(/<ht:news_item_url>([^<]+)<\/ht:news_item_url>/i)?.[1],
  ];
  for (const raw of hrefs) {
    const url = decodeXml(raw ?? "");
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
  }
  return "";
}

export interface TrendsRssItem {
  title: string;
  url: string;
  score: number;
}

export function parseTrendsRss(xml: string): TrendsRssItem[] {
  if (!xml.includes("<item")) return [];
  const out: TrendsRssItem[] = [];
  for (const chunk of xml.split(/<item[\s>]/).slice(1)) {
    const title = decodeXml(chunk.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const url = firstHref(chunk);
    if (!title || !url) continue;
    const traffic = decodeXml(chunk.match(/<ht:approx_traffic>([^<]+)<\/ht:approx_traffic>/i)?.[1] ?? "");
    const n = Number(traffic.replace(/[^\d]/g, ""));
    const score =
      Number.isFinite(n) && n > 0
        ? Math.min(100, Math.max(8, Math.round(Math.log10(n) * 20)))
        : Math.max(5, 80 - out.length * 3);
    out.push({ title, url, score });
  }
  return out;
}

/** Phrase lookups keep only RSS items that mention the plugged name. World tape keeps the day's list. */
export function filterTrendItems(items: TrendsRssItem[], topic?: string): TrendsRssItem[] {
  const phrase = topic?.trim();
  const seen = new Set<string>();
  const out: TrendsRssItem[] = [];
  for (const item of items) {
    if (phrase && !tokenHits(`${item.title} ${item.url}`, phrase)) continue;
    const key = item.url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function toPosts(items: TrendsRssItem[]): Post[] {
  return stampPosts(
    items.slice(0, 20).map((t) => ({
      platform: "public" as const,
      title: t.title,
      url: t.url,
      score: t.score,
      createdAt: new Date().toISOString(),
      sourceApi: "google-trends",
    })),
    "collect_google_trends",
  );
}

async function fetchTrendsRss(geo: string): Promise<TrendsRssItem[]> {
  const res = await fetch(`https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`, {
    cache: "no-store",
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml, */*",
      "User-Agent": TRENDS_UA,
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`trends rss ${geo} ${res.status}`);
  return parseTrendsRss(await res.text());
}

export async function fetchGoogleTrends(city: CityId = "all", topic?: string): Promise<Post[]> {
  const geos = trendsRssGeos(city);
  const settled = await Promise.allSettled(geos.map((g) => fetchTrendsRss(g)));
  const items = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  return toPosts(filterTrendItems(items, topic));
}

export async function fetchGoogleTrendsSafe(city: CityId = "all", topic?: string): Promise<Post[]> {
  try {
    return await fetchGoogleTrends(city, topic);
  } catch (err) {
    console.warn("[trends-fallback]", err instanceof Error ? err.message : err);
    return [];
  }
}

export async function fetchX(place?: string, topic?: string): Promise<Post[]> {
  const where = place ? ` in ${place}` : " worldwide";
  const phrase = topic?.trim();
  const prompt = phrase
    ? `Use Google Search for recent public posts on X/Twitter that mention this exact phrase (campaign, brand, hashtag, or product): "${phrase}"${where}.
This is a footprint lookup — return mentions of the phrase, not unrelated trending topics.
Only include URLs you actually retrieved. Never invent an x.com URL.
Return ONLY JSON: {"topics":[{"topic":"post title or quote that mentions the phrase","volume":0,"urls":["https://x.com/..."]}]}
volume is relative heat 0-100.`
    : `Use Google Search for the 10 hottest public topics in the last 24 hours worldwide (Asia, Africa, Europe, Latin America, and North America — not US-only)${place ? ` with extra weight on ${place}` : ""}.
Prefer public X/Twitter, news, and forum mentions. Only include URLs you actually retrieved.
Return ONLY JSON: {"topics":[{"topic":"short phrase","volume":0,"urls":["https://x.com/..."]}]}
volume is relative heat 0-100.`;
  const parsed = await geminiJson(
    prompt,
    (raw) => xTrendListSchema.parse(parseJsonObject(raw)),
    true,
  );
  return stampPosts(
    parsed.topics.map((t) => ({
      platform: "x" as const,
      title: t.topic,
      url: t.urls[0] ?? "https://x.com",
      score: t.volume,
      createdAt: new Date().toISOString(),
    })),
    "collect_x",
  );
}
