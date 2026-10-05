import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { WORLD_REDDIT } from "./geo";
import { stampPosts } from "./lineage";
import type { Post } from "./types";

const execFileP = promisify(execFile);

const DEFAULT_SUBS = WORLD_REDDIT;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 HawkxAI/0.1";

interface RedditChild {
  data?: {
    title?: string;
    permalink?: string;
    url?: string;
    ups?: number;
    score?: number;
    created_utc?: number;
    stickied?: boolean;
  };
}

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function rankScores(posts: Post[]): Post[] {
  const max = Math.max(0, ...posts.map((p) => p.score));
  if (max > 1) return posts;
  return posts.map((p, i) => ({ ...p, score: Math.max(5, 90 - i * 2) }));
}

function parseListing(json: { data?: { children?: RedditChild[] } }): Post[] {
  const children = json.data?.children ?? [];
  return children
    .map((c) => c.data)
    .filter((d): d is NonNullable<typeof d> => Boolean(d?.title) && !d?.stickied)
    .map((d) => {
      const path = d.permalink ?? "";
      return {
        platform: "reddit" as const,
        title: d.title ?? "",
        url: path
          ? `https://www.reddit.com${path}`
          : (d.url ?? "https://www.reddit.com"),
        score: Number(d.ups ?? d.score ?? 0),
        createdAt: new Date((d.created_utc ?? 0) * 1000).toISOString(),
      };
    });
}

function parseAtom(xml: string): Post[] {
  if (!xml.includes("<entry") && !xml.includes("<item")) {
    throw new Error("not atom/rss");
  }
  const chunks = xml.split(/<entry[\s>]|<item[\s>]/).slice(1);
  const posts: Post[] = [];
  for (const chunk of chunks) {
    const titleRaw =
      chunk.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
    const title = decodeXml(titleRaw.replace(/<[^>]+>/g, "").trim());
    const href =
      chunk.match(/<link[^>]*href="([^"]+)"/i)?.[1] ??
      chunk.match(/<link[^>]*>([^<]+)<\/link>/i)?.[1] ??
      "";
    const published =
      chunk.match(/<published>([^<]+)<\/published>/i)?.[1] ??
      chunk.match(/<updated>([^<]+)<\/updated>/i)?.[1] ??
      chunk.match(/<pubDate>([^<]+)<\/pubDate>/i)?.[1] ??
      new Date().toISOString();
    if (!title || !href) continue;
    if (/^https?:\/\/www\.reddit\.com\/r\/[^/]+\/?$/i.test(href)) continue;
    posts.push({
      platform: "reddit",
      title,
      url: href,
      score: 0,
      createdAt: new Date(published).toISOString(),
    });
  }
  if (!posts.length) throw new Error("rss empty");
  return rankScores(posts);
}

export function parseArctic(json: { data?: RedditChild["data"][] }): Post[] {
  const rows = json.data ?? [];
  const posts = rows
    .filter((d): d is NonNullable<typeof d> => Boolean(d?.title) && !d?.stickied)
    .map((d) => {
      const path = d.permalink ?? "";
      return {
        platform: "reddit" as const,
        title: d.title ?? "",
        url: path
          ? `https://www.reddit.com${path}`
          : (d.url ?? "https://www.reddit.com"),
        score: Number(d.ups ?? d.score ?? 0),
        createdAt: new Date((d.created_utc ?? 0) * 1000).toISOString(),
      };
    });
  if (!posts.length) throw new Error("arctic-shift empty");
  return rankScores(posts);
}

async function curlText(url: string): Promise<string> {
  const bin = process.platform === "win32" ? "curl.exe" : "curl";
  const { stdout } = await execFileP(
    bin,
    [
      "-sS",
      "-f",
      "-L",
      "--max-time",
      "15",
      "-A",
      UA,
      "-H",
      "Accept: application/atom+xml, application/rss+xml, application/json, */*",
      url,
    ],
    { encoding: "utf8", maxBuffer: 4_000_000, windowsHide: true },
  );
  return stdout;
}

async function httpText(url: string, accept: string): Promise<string> {
  try {
    return await curlText(url);
  } catch {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: accept },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${url} ${res.status}`);
    return res.text();
  }
}

async function pullJson(sub: string): Promise<Post[]> {
  const urls = [
    `https://www.reddit.com/r/${sub}/hot.json?limit=50&raw_json=1`,
    `https://old.reddit.com/r/${sub}/hot.json?limit=50&raw_json=1`,
  ];
  let last = "json failed";
  for (const url of urls) {
    try {
      const text = await httpText(url, "application/json");
      if (text.trimStart().startsWith("<")) {
        last = `${url} html-block`;
        continue;
      }
      const posts = parseListing(
        JSON.parse(text) as { data?: { children?: RedditChild[] } },
      );
      if (posts.length) return posts;
      last = `${url} empty`;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(last);
}

async function pullRss(sub: string): Promise<Post[]> {
  const urls = [
    `https://www.reddit.com/r/${sub}/hot/.rss?limit=40`,
    `https://old.reddit.com/r/${sub}/hot/.rss?limit=40`,
  ];
  let last = "rss failed";
  for (const url of urls) {
    try {
      const xml = await httpText(
        url,
        "application/atom+xml, application/rss+xml, application/xml, text/xml",
      );
      return parseAtom(xml);
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(last);
}

async function pullArchive(sub: string): Promise<Post[]> {
  const after = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const url = `https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=${sub}&after=${after}&sort=desc&limit=50`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`arctic-shift ${sub} ${res.status}`);
  return parseArctic((await res.json()) as { data?: RedditChild["data"][] });
}

async function fetchOfficial(sub: string): Promise<Post[]> {
  try {
    return await pullJson(sub);
  } catch {
    return pullRss(sub);
  }
}

export async function fetchReddit(
  subs: string[] = [...DEFAULT_SUBS],
): Promise<Post[]> {
  const list = [...new Set(subs.map((s) => s.trim()).filter(Boolean))];
  if (!list.length) throw new Error("reddit: no subreddits");

  const probe = list.includes("worldnews")
    ? "worldnews"
    : list.includes("technology")
      ? "technology"
      : list[0];
  let official: Post[] = [];
  try {
    official = await fetchOfficial(probe);
  } catch (err) {
    console.warn(
      "[reddit] official json/rss blocked",
      err instanceof Error ? err.message : err,
    );
  }

  const rest = official.length ? list.filter((s) => s !== probe) : list;
  const settled = await Promise.allSettled(rest.map((s) => pullArchive(s)));
  const posts = [...official];
  let archiveOk = 0;
  for (const item of settled) {
    if (item.status === "fulfilled") {
      posts.push(...item.value);
      archiveOk += 1;
    } else {
      console.warn("[reddit] archive sub failed", item.reason);
    }
  }
  if (!posts.length) throw new Error("reddit: all subreddits failed");
  console.log(
    `[reddit] ${posts.length} posts (official=${official.length ? probe : "none"}, archive=${archiveOk}/${rest.length})`,
  );
  return stampPosts(posts, "collect_reddit");
}

export async function searchReddit(query: string): Promise<Post[]> {
  const q = query.trim();
  if (!q) return fetchReddit();
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=hot&limit=25&raw_json=1`;
  try {
    const text = await httpText(url, "application/json");
    if (text.trimStart().startsWith("<")) throw new Error("html-block");
    const posts = parseListing(JSON.parse(text) as { data?: { children?: RedditChild[] } });
    if (posts.length) {
      console.log(`[reddit] search "${q}" ${posts.length}`);
      return stampPosts(posts, "collect_reddit");
    }
  } catch (err) {
    console.warn("[reddit] search failed", err instanceof Error ? err.message : err);
  }
  return fetchReddit();
}
