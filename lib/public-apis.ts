import { cacheGet, cacheSet } from "./cache";
import { stampPost } from "./lineage";
import type { CityId } from "./geo";
import { tvCountry, weatherSpots, youtubeRegions } from "./geo";
import { filterByEnabledSources } from "./api-source-selection";
import { pickFeeds, recordPulls } from "./rl";
import type { Post, PublicApiFeedStat, PublicApiIngest } from "./types";

const CATALOG_URL =
  "https://raw.githubusercontent.com/public-apis/public-apis/master/README.md";
const UA =
  "HawkxAI/1.0 (+https://github.com/snagaram3/grokhackx; srihari.ec09@gmail.com)";
const CATALOG_KEY = "public-apis:catalog";
const PER_FEED = 8;
const MAX_POSTS = 160;
const FEED_MS = 8_000;
const DEFAULT_FEED_BUDGET = 28;
const TOPIC_FEED_BUDGET = 32;
const GDELT_TTL_MS = 10 * 60_000;
const BSKY_HOT =
  "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot";

const CORE_TAPE = [
  "Wikipedia",
  "Google News",
  "BBC",
  "Guardian",
  "Reuters",
  "Al Jazeera",
  "NHK World",
  "National Weather Service",
  "GDACS",
  "CoinGecko",
  "Bluesky",
  "Federal Register",
];

export interface PublicApiEntry {
  name: string;
  description: string;
  auth: string;
  https: boolean;
  cors: string;
  category: string;
  url: string;
}

export interface PublicApiCollect {
  posts: Post[];
  ingest: PublicApiIngest;
}

interface Feed {
  name: string;
  category: string;
  match: string[];
  topicAware?: boolean;
  include?: (topic?: string) => boolean;
  run: (city: CityId, topic?: string) => Promise<Post[]>;
}

function googleNewsRss(q: string, edition = "hl=en&gl=GB&ceid=GB:en"): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&${edition}`;
}

function youtubeItems(data: unknown): Post[] {
  return asArray(asRecord(data)?.items)
    .map((row) => {
      const item = asRecord(row);
      const snippet = asRecord(item?.snippet);
      const title = str(snippet?.title);
      const id = str(asRecord(item?.id)?.videoId) || str(item?.id);
      if (!title || !id) return null;
      return post(title, `https://www.youtube.com/watch?v=${id}`, 60, "YouTube", str(snippet?.publishedAt) || undefined);
    })
    .filter((p): p is Post => Boolean(p));
}

function geoPoint(lat: number, lon: number, label: string): Post["geo"] | undefined {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return undefined;
  const name = label.trim().slice(0, 80);
  if (!name) return undefined;
  return { lat, lon, label: name };
}

function firstLonLat(raw: unknown): [number, number] | null {
  if (!Array.isArray(raw) || raw.length < 1) return null;
  if (typeof raw[0] === "number" && typeof raw[1] === "number") {
    return [raw[0], raw[1]];
  }
  return firstLonLat(raw[0]);
}

function geoFromCoords(raw: unknown, label: string): Post["geo"] | undefined {
  const pair = firstLonLat(raw);
  if (!pair) return undefined;
  return geoPoint(pair[1], pair[0], label);
}

function post(
  title: string,
  url: string,
  score: number,
  sourceApi: string,
  createdAt?: string,
  geo?: Post["geo"],
): Post {
  return stampPost(
    {
      platform: "public",
      title: title.slice(0, 180),
      url,
      score: Math.max(1, Math.round(score)),
      createdAt: createdAt ?? new Date().toISOString(),
      sourceApi,
      geo,
    },
    "collect_public_apis",
  );
}

async function getText(url: string, ms = FEED_MS): Promise<string> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*", "User-Agent": UA },
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.text();
}

function parseRss(xml: string, sourceApi: string): Post[] {
  if (!xml.includes("<item") && !xml.includes("<entry")) throw new Error(`${sourceApi} not rss`);
  const chunks = xml.split(/<entry[\s>]|<item[\s>]/).slice(1);
  const posts: Post[] = [];
  for (const chunk of chunks) {
    const titleRaw = chunk.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
    const title = titleRaw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim();
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
    posts.push(post(title, href.trim(), Math.max(5, 80 - posts.length * 3), sourceApi, published));
  }
  if (!posts.length) throw new Error(`${sourceApi} rss empty`);
  return posts.slice(0, PER_FEED);
}

async function getJson(url: string, ms = FEED_MS): Promise<unknown> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json, text/plain, */*", "User-Agent": UA },
    signal: AbortSignal.timeout(ms),
  });
  const text = await res.text();
  if (res.status === 429 || /limit requests/i.test(text)) {
    throw new Error(`${url} 429`);
  }
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  if (!text || text.startsWith("<")) throw new Error(`${url} not json`);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${url} not json`);
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function noAuth(auth: string): boolean {
  const a = auth.trim().toLowerCase().replace(/[`*]/g, "");
  return a === "no" || a === "none" || a === "" || a === "null";
}

export function parsePublicApisReadme(md: string): PublicApiEntry[] {
  const entries: PublicApiEntry[] = [];
  let category = "Uncategorized";
  for (const line of md.split("\n")) {
    const heading = line.match(/^###\s+(.+)/);
    if (heading) {
      category = heading[1].trim();
      continue;
    }
    const row = line.match(
      /^\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*([^|]*)\|\s*([^|]*)\|\s*([^|]*)\|\s*([^|]*)\|/,
    );
    if (!row) continue;
    const name = row[1].trim();
    if (!name || name === "API") continue;
    entries.push({
      name,
      url: row[2].trim(),
      description: row[3].trim(),
      auth: row[4].trim(),
      https: /yes/i.test(row[5]),
      cors: row[6].trim(),
      category,
    });
  }
  return entries;
}

export async function loadPublicApiCatalog(): Promise<PublicApiEntry[]> {
  const cached = cacheGet<PublicApiEntry[]>(CATALOG_KEY);
  if (cached?.length) return cached;
  const res = await fetch(CATALOG_URL, {
    cache: "no-store",
    headers: { Accept: "text/plain", "User-Agent": UA },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`public-apis catalog ${res.status}`);
  const entries = parsePublicApisReadme(await res.text());
  cacheSet(CATALOG_KEY, entries);
  return entries;
}

function utcYmd(daysAgo: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return {
    y: d.getUTCFullYear(),
    m: String(d.getUTCMonth() + 1).padStart(2, "0"),
    day: String(d.getUTCDate()).padStart(2, "0"),
  };
}

function youtubeKey(): string {
  return process.env.YOUTUBE_API_KEY?.trim() || "";
}

const MODEL_MAKE: Record<string, { make: string; model: string }> = {
  camry: { make: "toyota", model: "camry" },
  corolla: { make: "toyota", model: "corolla" },
  civic: { make: "honda", model: "civic" },
  accord: { make: "honda", model: "accord" },
  mustang: { make: "ford", model: "mustang" },
  "f-150": { make: "ford", model: "f-150" },
  f150: { make: "ford", model: "f-150" },
  tesla: { make: "tesla", model: "model 3" },
};

const VEHICLE_MAKES = [
  "toyota",
  "honda",
  "ford",
  "tesla",
  "chevrolet",
  "bmw",
  "hyundai",
  "kia",
  "nissan",
  "subaru",
  "volkswagen",
  "audi",
  "mazda",
  "jeep",
  "lexus",
  "volvo",
  "gmc",
  "ram",
];

export function vehicleQuery(topic: string): { make: string; model: string; year?: string } | null {
  const raw = topic.trim().toLowerCase().replace(/[^a-z0-9 -]/g, " ");
  if (!raw) return null;
  const year = raw.match(/\b(20\d{2})\b/)?.[1];
  for (const [alias, v] of Object.entries(MODEL_MAKE)) {
    if (raw.includes(alias)) return year ? { ...v, year } : v;
  }
  const tokens = raw.split(/\s+/).filter(Boolean);
  const make = tokens.find((t) => VEHICLE_MAKES.includes(t));
  if (!make) return null;
  const model = tokens.filter((t) => t !== make && t !== year).join(" ") || make;
  return year ? { make, model, year } : { make, model };
}

function gdeltStamp(raw: string): string | undefined {
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return raw || undefined;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}

function mapGdeltArticles(data: unknown): Post[] {
  return asArray(asRecord(data)?.articles)
    .map((row) => {
      const a = asRecord(row);
      if (!a || !str(a.title) || !str(a.url)) return null;
      return post(str(a.title), str(a.url), 70, "GDELT", gdeltStamp(str(a.seendate)));
    })
    .filter((p): p is Post => Boolean(p))
    .slice(0, PER_FEED);
}

let gdeltTape: { exp: number; posts: Promise<Post[]> } | null = null;

async function fetchGdelt(topic?: string): Promise<Post[]> {
  const q = topic?.trim() ? `${topic.trim()} sourcelang:english` : "sourcelang:english";
  const url =
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}` +
    `&mode=ArtList&maxrecords=20&format=json&sort=DateDesc&timespan=24h`;
  return mapGdeltArticles(await getJson(url));
}

function wikiPostsFromFeatured(data: unknown): Post[] {
  const most = asArray(asRecord(asRecord(data)?.mostread)?.articles);
  const fromMost = most
    .map((row) => {
      const a = asRecord(row);
      const titles = asRecord(a?.titles);
      const title = str(titles?.normalized) || str(a?.title).replace(/_/g, " ");
      const urls = asRecord(asRecord(a?.content_urls)?.desktop);
      const href =
        str(urls?.page) ||
        (title ? `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}` : "");
      if (!title || /^(Special:|Main Page|Wiki|Portal:|File:)/i.test(title) || !href) return null;
      return post(
        `Wikipedia: ${title}`,
        href,
        Math.min(100, Math.log10(num(a?.views) + 1) * 18),
        "Wikipedia",
      );
    })
    .filter((p): p is Post => Boolean(p));
  if (fromMost.length) return fromMost.slice(0, PER_FEED);
  const tfa = asRecord(asRecord(data)?.tfa);
  const tfaTitle = str(asRecord(tfa?.titles)?.normalized) || str(tfa?.title);
  const tfaHref = str(asRecord(asRecord(tfa?.content_urls)?.desktop)?.page);
  return tfaTitle && tfaHref ? [post(`Wikipedia: ${tfaTitle}`, tfaHref, 80, "Wikipedia")] : [];
}

function wikiPostsFromPageviews(data: unknown): Post[] {
  const articles = asArray(asRecord(asArray(asRecord(data)?.items)[0])?.articles);
  return articles
    .map((row) => {
      const a = asRecord(row);
      const title = str(a?.article).replace(/_/g, " ");
      if (!title || /^(Special:|Main Page|Wiki|Portal:|File:)/i.test(title)) return null;
      return post(
        `Wikipedia: ${title}`,
        `https://en.wikipedia.org/wiki/${encodeURIComponent(str(a?.article))}`,
        Math.min(100, Math.log10(num(a?.views) + 1) * 18),
        "Wikipedia",
      );
    })
    .filter((p): p is Post => Boolean(p))
    .slice(0, PER_FEED);
}

async function wikipediaTape(): Promise<Post[]> {
  for (const ago of [0, 1, 2]) {
    const { y, m, day } = utcYmd(ago);
    try {
      const posts = wikiPostsFromFeatured(
        await getJson(`https://en.wikipedia.org/api/rest_v1/feed/featured/${y}/${m}/${day}`),
      );
      if (posts.length) return posts;
    } catch {
      /* try older featured, then pageviews */
    }
  }
  for (const ago of [2, 3, 4, 5, 6]) {
    const { y, m, day } = utcYmd(ago);
    try {
      const posts = wikiPostsFromPageviews(
        await getJson(
          `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${y}/${m}/${day}`,
        ),
      );
      if (posts.length) return posts;
    } catch {
      /* keep walking back */
    }
  }
  throw new Error("Wikipedia empty");
}

function bskyHref(uri: string, handle: string): string {
  const rkey = uri.split("/").pop() || "";
  return handle && rkey ? `https://bsky.app/profile/${handle}/post/${rkey}` : "";
}

function mapBskyPost(row: unknown): Post | null {
  const p = asRecord(row);
  if (!p) return null;
  const author = asRecord(p.author);
  const record = asRecord(p.record);
  const text = str(record?.text) || str(p.text);
  const handle = str(author?.handle);
  const href = bskyHref(str(p.uri), handle);
  if (!text || !href) return null;
  return post(text, href, 55, "Bluesky", str(record?.createdAt) || str(p.indexedAt) || undefined);
}

function mapBskySearch(data: unknown): Post[] {
  return asArray(asRecord(data)?.posts)
    .map(mapBskyPost)
    .filter((p): p is Post => Boolean(p))
    .slice(0, PER_FEED);
}

function mapBskyFeed(data: unknown): Post[] {
  return asArray(asRecord(data)?.feed)
    .map((row) => mapBskyPost(asRecord(row)?.post))
    .filter((p): p is Post => Boolean(p))
    .slice(0, PER_FEED);
}

async function blueskyPosts(topic?: string): Promise<Post[]> {
  const q = topic?.trim();
  if (q) {
    try {
      const hit = mapBskySearch(
        await getJson(
          `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(q)}&limit=${PER_FEED}`,
        ),
      );
      if (hit.length) return hit;
    } catch {
      /* search is Cloudflare-blocked from some clouds; fall through to what's-hot */
    }
  }
  const hot = mapBskyFeed(
    await getJson(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.getFeed?feed=${encodeURIComponent(BSKY_HOT)}&limit=25`,
    ),
  );
  if (q) {
    const needle = q.toLowerCase();
    return hot.filter((p) => p.title.toLowerCase().includes(needle)).slice(0, PER_FEED);
  }
  return hot.slice(0, PER_FEED);
}

const FEEDS: Feed[] = [
  {
    name: "GDELT",
    category: "News",
    match: ["gdelt"],
    topicAware: true,
    run: async (_city, topic) => {
      if (topic?.trim()) return fetchGdelt(topic);
      if (gdeltTape && gdeltTape.exp > Date.now()) return gdeltTape.posts;
      const posts = fetchGdelt();
      gdeltTape = { exp: Date.now() + GDELT_TTL_MS, posts };
      return posts;
    },
  },
  {
    name: "Wikipedia",
    category: "Open Data",
    match: ["wikipedia"],
    topicAware: true,
    run: async (_city, topic) => {
      if (topic?.trim()) {
        const data = asArray(
          await getJson(
            `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(topic.trim())}&limit=10&namespace=0&format=json`,
          ),
        );
        const titles = asArray(data[1]).map(str);
        const urls = asArray(data[3]).map(str);
        const posts = titles
          .map((title, i) =>
            title && urls[i] ? post(`Wikipedia: ${title}`, urls[i], 80 - i * 4, "Wikipedia") : null,
          )
          .filter((p): p is Post => Boolean(p));
        if (posts.length) return posts;
      }
      return wikipediaTape();
    },
  },
  {
    name: "CoinGecko",
    category: "Cryptocurrency",
    match: ["coingecko"],
    topicAware: true,
    run: async (_city, topic) => {
      if (topic?.trim()) {
        const data = asRecord(
          await getJson(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(topic.trim())}`),
        );
        return asArray(data?.coins)
          .slice(0, PER_FEED)
          .map((row, i) => {
            const c = asRecord(row);
            const name = str(c?.name);
            if (!name) return null;
            const symbol = str(c?.symbol);
            return post(
              `${name}${symbol ? ` ($${symbol.toUpperCase()})` : ""}`,
              `https://www.coingecko.com/en/coins/${str(c?.id) || name}`,
              85 - i * 5,
              "CoinGecko",
            );
          })
          .filter((p): p is Post => Boolean(p));
      }
      const data = asRecord(await getJson("https://api.coingecko.com/api/v3/search/trending"));
      return asArray(data?.coins)
        .map((row) => {
          const item = asRecord(asRecord(row)?.item);
          if (!item || !str(item.name)) return null;
          const symbol = str(item.symbol);
          return post(
            `${str(item.name)}${symbol ? ` ($${symbol.toUpperCase()})` : ""} trending`,
            `https://www.coingecko.com/en/coins/${str(item.id) || str(item.name)}`,
            90 - num(item.score) * 4,
            "CoinGecko",
          );
        })
        .filter((p): p is Post => Boolean(p))
        .slice(0, PER_FEED);
    },
  },
  {
    name: "USGS",
    category: "Environment",
    match: ["usgs", "earthquake"],
    run: async () => {
      const data = asRecord(
        await getJson(
          "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson",
        ),
      );
      return asArray(data?.features)
        .map((row) => {
          const f = asRecord(row);
          const props = asRecord(f?.properties);
          if (!props || !str(props.title)) return null;
          const title = str(props.title);
          return post(
            title,
            str(props.url) || "https://earthquake.usgs.gov/",
            Math.min(100, num(props.mag) * 12),
            "USGS",
            num(props.time) ? new Date(num(props.time)).toISOString() : undefined,
            geoFromCoords(asRecord(f?.geometry)?.coordinates, title),
          );
        })
        .filter((p): p is Post => Boolean(p))
        .slice(0, PER_FEED);
    },
  },
  {
    name: "NASA EONET",
    category: "Science & Math",
    match: ["eonet", "nasa"],
    run: async () => {
      const data = asRecord(await getJson("https://eonet.gsfc.nasa.gov/api/v3/events?limit=12&days=7"));
      return asArray(data?.events)
        .map((row) => {
          const e = asRecord(row);
          if (!e || !str(e.title)) return null;
          const title = str(e.title);
          const link = str(asRecord(asArray(e.sources)[0])?.url) || str(e.link);
          const geom0 = asRecord(asArray(e.geometry)[0]);
          return post(
            title,
            link || "https://eonet.gsfc.nasa.gov/",
            65,
            "NASA EONET",
            str(geom0?.date) || undefined,
            geoFromCoords(geom0?.coordinates, title),
          );
        })
        .filter((p): p is Post => Boolean(p))
        .slice(0, PER_FEED);
    },
  },
  {
    name: "National Weather Service",
    category: "Weather",
    match: ["national weather service", "weather.gov", "noaa"],
    run: async () => {
      const data = asRecord(
        await getJson("https://api.weather.gov/alerts/active?status=actual&message_type=alert"),
      );
      return asArray(data?.features)
        .map((row) => {
          const props = asRecord(asRecord(row)?.properties);
          if (!props || !str(props.headline)) return null;
          const headline = str(props.headline);
          const sev =
            str(props.severity) === "Extreme" ? 95 : str(props.severity) === "Severe" ? 80 : 55;
          const href =
            str(props["@id"]) ||
            str(props.id).replace(/^urn:oid:/, "https://api.weather.gov/alerts/") ||
            "https://www.weather.gov/";
          const geom = asRecord(asRecord(row)?.geometry);
          return post(
            headline,
            href,
            sev,
            "NWS",
            str(props.sent) || undefined,
            geoFromCoords(geom?.coordinates, headline),
          );
        })
        .filter((p): p is Post => Boolean(p))
        .slice(0, PER_FEED);
    },
  },
  {
    name: "GDACS",
    category: "Weather",
    match: ["gdacs", "disaster"],
    run: async () => parseRss(await getText("https://www.gdacs.org/xml/rss.xml"), "GDACS"),
  },
  {
    name: "Open-Meteo",
    category: "Weather",
    match: ["open-meteo", "open meteo"],
    run: async (city) => {
      const spots = weatherSpots(city);
      const data = await getJson(
        `https://api.open-meteo.com/v1/forecast?latitude=${spots.map((s) => s.lat).join(",")}&longitude=${spots.map((s) => s.lon).join(",")}&current=temperature_2m,weather_code,wind_speed_10m`,
      );
      const rows = Array.isArray(data) ? data : [data];
      const fromRows = rows
        .map((row, i) => {
          const rec = asRecord(row);
          const cur = asRecord(rec?.current);
          const spot = spots[i] ?? spots[0];
          if (!cur || !spot || Array.isArray(cur.temperature_2m)) return null;
          return post(
            `${spot.label} ${num(cur.temperature_2m)}°C wind ${num(cur.wind_speed_10m)}`,
            `https://open-meteo.com/en/docs#latitude=${spot.lat}&longitude=${spot.lon}`,
            40,
            "Open-Meteo",
            str(cur.time) || undefined,
            geoPoint(spot.lat, spot.lon, spot.label),
          );
        })
        .filter((p): p is Post => Boolean(p));
      if (fromRows.length) return fromRows.slice(0, city === "all" ? 12 : PER_FEED);
      const cur = asRecord(asRecord(rows[0])?.current);
      if (!cur || !Array.isArray(cur.temperature_2m)) return [];
      return spots
        .map((spot, i) =>
          post(
            `${spot.label} ${num(asArray(cur.temperature_2m)[i])}°C wind ${num(asArray(cur.wind_speed_10m)[i])}`,
            `https://open-meteo.com/en/docs#latitude=${spot.lat}&longitude=${spot.lon}`,
            40,
            "Open-Meteo",
            str(asArray(cur.time)[i]) || undefined,
            geoPoint(spot.lat, spot.lon, spot.label),
          ),
        )
        .slice(0, city === "all" ? 12 : PER_FEED);
    },
  },
  {
    name: "TVMaze",
    category: "Video",
    match: ["tvmaze"],
    topicAware: true,
    run: async (_city, topic) => {
      if (topic?.trim()) {
        const rows = asArray(
          await getJson(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(topic.trim())}`),
        );
        return rows
          .map((row, i) => {
            const show = asRecord(asRecord(row)?.show);
            const name = str(show?.name);
            if (!name) return null;
            return post(name, str(show?.url) || "https://www.tvmaze.com/", 80 - i * 4, "TVMaze");
          })
          .filter((p): p is Post => Boolean(p))
          .slice(0, PER_FEED);
      }
      const country = tvCountry(_city);
      const rows = asArray(
        await getJson(
          country
            ? `https://api.tvmaze.com/schedule?country=${encodeURIComponent(country)}`
            : "https://api.tvmaze.com/schedule/web",
        ),
      );
      return rows
        .map((row) => {
          const r = asRecord(row);
          const show = asRecord(r?.show) || asRecord(asRecord(r?._embedded)?.show);
          const name = str(show?.name);
          if (!name) return null;
          const ep = str(r?.name);
          return post(
            ep ? `${name}: ${ep}` : name,
            str(show?.url) || "https://www.tvmaze.com/",
            45,
            "TVMaze",
            str(r?.airdate) || undefined,
          );
        })
        .filter((p): p is Post => Boolean(p))
        .slice(0, PER_FEED);
    },
  },
  {
    name: "Open Library",
    category: "Books",
    match: ["open library"],
    topicAware: true,
    run: async (_city, topic) => {
      if (topic?.trim()) {
        const data = asRecord(
          await getJson(
            `https://openlibrary.org/search.json?q=${encodeURIComponent(topic.trim())}&limit=${PER_FEED}`,
          ),
        );
        return asArray(data?.docs)
          .map((row) => {
            const w = asRecord(row);
            const title = str(w?.title);
            if (!title) return null;
            const key = str(w?.key);
            return post(
              title,
              key ? `https://openlibrary.org${key}` : "https://openlibrary.org/",
              60,
              "Open Library",
            );
          })
          .filter((p): p is Post => Boolean(p));
      }
      try {
        const data = asRecord(await getJson("https://openlibrary.org/trending/daily.json"));
        const trending = asArray(data?.works)
          .map((row) => {
            const w = asRecord(row);
            if (!w || !str(w.title)) return null;
            const key = str(w.key);
            return post(
              str(w.title),
              key ? `https://openlibrary.org${key}` : "https://openlibrary.org/",
              Math.min(90, num(w.logged_edition) || 50),
              "Open Library",
            );
          })
          .filter((p): p is Post => Boolean(p))
          .slice(0, PER_FEED);
        if (trending.length) return trending;
      } catch {
        /* trending often times out from serverless */
      }
      const fallback = asRecord(await getJson("https://openlibrary.org/search.json?q=language%3Aeng&limit=8"));
      return asArray(fallback?.docs)
        .map((row) => {
          const w = asRecord(row);
          const title = str(w?.title);
          if (!title) return null;
          const key = str(w?.key);
          return post(title, key ? `https://openlibrary.org${key}` : "https://openlibrary.org/", 50, "Open Library");
        })
        .filter((p): p is Post => Boolean(p));
    },
  },
  {
    name: "Dev.to",
    category: "Development",
    match: ["dev.to", "devto"],
    topicAware: true,
    run: async (_city, topic) => {
      const tag = topic?.trim().split(/\s+/)[0]?.toLowerCase();
      const url = tag
        ? `https://dev.to/api/articles?per_page=12&tag=${encodeURIComponent(tag)}`
        : "https://dev.to/api/articles?per_page=12&top=1";
      const rows = asArray(await getJson(url));
      return rows
        .map((row) => {
          const a = asRecord(row);
          if (!a || !str(a.title) || !str(a.url)) return null;
          return post(str(a.title), str(a.url), Math.min(100, num(a.positive_reactions_count)), "Dev.to");
        })
        .filter((p): p is Post => Boolean(p))
        .slice(0, PER_FEED);
    },
  },
  {
    name: "GitHub",
    category: "Development",
    match: ["github"],
    topicAware: true,
    run: async (_city, topic) => {
      if (topic?.trim()) {
        const data = asRecord(
          await getJson(
            `https://api.github.com/search/repositories?q=${encodeURIComponent(topic.trim())}&sort=updated&per_page=${PER_FEED}`,
          ),
        );
        return asArray(data?.items)
          .map((row, i) => {
            const r = asRecord(row);
            const name = str(r?.full_name);
            if (!name) return null;
            return post(
              `GitHub: ${name}`,
              str(r?.html_url) || `https://github.com/${name}`,
              Math.min(100, num(r?.stargazers_count) / 50 || 80 - i * 4),
              "GitHub",
            );
          })
          .filter((p): p is Post => Boolean(p));
      }
      const rows = asArray(await getJson("https://api.github.com/events"));
      const counts = new Map<string, { n: number; url: string }>();
      for (const row of rows) {
        const e = asRecord(row);
        const repo = asRecord(e?.repo);
        const name = str(repo?.name);
        if (!name) continue;
        const prev = counts.get(name) ?? { n: 0, url: `https://github.com/${name}` };
        prev.n += 1;
        counts.set(name, prev);
      }
      return [...counts.entries()]
        .toSorted((a, b) => b[1].n - a[1].n)
        .slice(0, PER_FEED)
        .map(([name, v]) => post(`GitHub: ${name}`, v.url, Math.min(100, v.n * 12), "GitHub"));
    },
  },
  {
    name: "Spaceflight News",
    category: "Science & Math",
    match: ["spaceflight news", "snapi"],
    topicAware: true,
    run: async (_city, topic) => {
      const q = topic?.trim()
        ? `https://api.spaceflightnewsapi.net/v4/articles/?limit=12&search=${encodeURIComponent(topic.trim())}`
        : "https://api.spaceflightnewsapi.net/v4/articles/?limit=12";
      const data = asRecord(await getJson(q));
      return asArray(data?.results)
        .map((row) => {
          const a = asRecord(row);
          if (!a || !str(a.title) || !str(a.url)) return null;
          return post(str(a.title), str(a.url), 60, "Spaceflight News", str(a.published_at) || undefined);
        })
        .filter((p): p is Post => Boolean(p))
        .slice(0, PER_FEED);
    },
  },
  {
    name: "FBI Wanted",
    category: "Government",
    match: ["fbi"],
    run: async () => {
      const data = asRecord(await getJson("https://api.fbi.gov/wanted/v1/list?pageSize=10"));
      return asArray(data?.items)
        .map((row) => {
          const i = asRecord(row);
          const title = str(i?.title);
          if (!title) return null;
          return post(
            `FBI Wanted: ${title}`,
            str(i?.url) || "https://www.fbi.gov/wanted",
            50,
            "FBI",
            str(i?.publication) || undefined,
          );
        })
        .filter((p): p is Post => Boolean(p))
        .slice(0, PER_FEED);
    },
  },
  {
    name: "Disease.sh",
    category: "Health",
    match: ["disease.sh", "disease"],
    run: async () => {
      const rows = asArray(
        await getJson("https://disease.sh/v3/covid-19/countries?sort=todayCases"),
      );
      return rows
        .slice(0, PER_FEED)
        .map((row) => {
          const c = asRecord(row);
          const name = str(c?.country);
          if (!name) return null;
          const today = num(c?.todayCases);
          return post(
            `${name}: ${today} new COVID cases`,
            "https://disease.sh/",
            Math.min(100, Math.log10(today + 1) * 20),
            "Disease.sh",
          );
        })
        .filter((p): p is Post => Boolean(p));
    },
  },
  {
    name: "TheSportsDB",
    category: "Sports & Fitness",
    match: ["thesportsdb", "sportsdb"],
    topicAware: true,
    run: async (_city, topic) => {
      if (topic?.trim()) {
        const data = asRecord(
          await getJson(
            `https://www.thesportsdb.com/api/v1/json/3/searchevents.php?e=${encodeURIComponent(topic.trim())}`,
          ),
        );
        const events = asArray(data?.event ?? data?.events);
        if (events.length) {
          return events
            .map((row) => {
              const e = asRecord(row);
              const title = str(e?.strEvent);
              if (!title) return null;
              return post(
                title,
                `https://www.thesportsdb.com/event/${str(e?.idEvent)}`,
                70,
                "TheSportsDB",
                str(e?.dateEvent) || undefined,
              );
            })
            .filter((p): p is Post => Boolean(p))
            .slice(0, PER_FEED);
        }
      }
      const data = asRecord(
        await getJson("https://www.thesportsdb.com/api/v1/json/3/eventspastleague.php?id=4328"),
      );
      return asArray(data?.events)
        .map((row) => {
          const e = asRecord(row);
          const title = str(e?.strEvent);
          if (!title) return null;
          return post(
            title,
            str(e?.strVideo) || `https://www.thesportsdb.com/event/${str(e?.idEvent)}`,
            55,
            "TheSportsDB",
            str(e?.dateEvent) || undefined,
          );
        })
        .filter((p): p is Post => Boolean(p))
        .slice(0, PER_FEED);
    },
  },
  {
    name: "ESPN",
    category: "Sports & Fitness",
    match: ["espn"],
    run: async () => {
      const urls = [
        "https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard",
        "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard",
        "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
      ];
      const settled = await Promise.allSettled(urls.map((u) => getJson(u)));
      const posts: Post[] = [];
      for (const item of settled) {
        if (item.status !== "fulfilled") continue;
        for (const row of asArray(asRecord(item.value)?.events)) {
          const e = asRecord(row);
          const name = str(e?.name);
          if (!name) continue;
          const status = str(asRecord(asRecord(e?.status)?.type)?.description);
          posts.push(
            post(
              status ? `${name} (${status})` : name,
              "https://www.espn.com/",
              58,
              "ESPN",
              str(e?.date) || undefined,
            ),
          );
        }
      }
      return posts.slice(0, PER_FEED);
    },
  },
  {
    name: "SpaceX",
    category: "Science & Math",
    match: ["spacex"],
    run: async () => {
      try {
        const rows = asArray(await getJson("https://api.spacexdata.com/v5/launches/upcoming"));
        const posts = rows
          .slice(0, PER_FEED)
          .map((row) => {
            const l = asRecord(row);
            const name = str(l?.name);
            if (!name) return null;
            return post(
              `SpaceX: ${name}`,
              str(asRecord(l?.links)?.webcast) || "https://www.spacex.com/launches/",
              62,
              "SpaceX",
              str(l?.date_utc) || undefined,
            );
          })
          .filter((p): p is Post => Boolean(p));
        if (posts.length) return posts;
      } catch {
        /* api.spacexdata.com often 525s; Launch Library 2 is free and live */
      }
      const data = asRecord(
        await getJson("https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=8&lsp__name=SpaceX"),
      );
      return asArray(data?.results)
        .map((row) => {
          const l = asRecord(row);
          const name = str(l?.name);
          if (!name) return null;
          return post(
            `SpaceX: ${name}`,
            str(l?.url) || "https://www.spacex.com/launches/",
            62,
            "SpaceX",
            str(l?.net) || undefined,
          );
        })
        .filter((p): p is Post => Boolean(p))
        .slice(0, PER_FEED);
    },
  },
  {
    name: "Frankfurter",
    category: "Currency Exchange",
    match: ["frankfurter"],
    run: async () => {
      const data = asRecord(await getJson("https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,INR"));
      const rates = asRecord(data?.rates);
      if (!rates) return [];
      return Object.entries(rates).map(([code, value]) =>
        post(`USD/${code} ${num(value)}`, "https://www.frankfurter.app/", 35, "Frankfurter"),
      );
    },
  },
  {
    name: "CheapShark",
    category: "Shopping",
    match: ["cheapshark"],
    topicAware: true,
    run: async (_city, topic) => {
      const url = topic?.trim()
        ? `https://www.cheapshark.com/api/1.0/deals?pageSize=10&title=${encodeURIComponent(topic.trim())}`
        : "https://www.cheapshark.com/api/1.0/deals?pageSize=10&sortBy=Deal%20Rating";
      const rows = asArray(await getJson(url));
      return rows
        .map((row) => {
          const d = asRecord(row);
          const title = str(d?.title);
          if (!title) return null;
          const savings = num(d?.savings);
          const dealId = str(d?.dealID);
          return post(
            `${title} −${Math.round(savings)}%`,
            dealId
              ? `https://www.cheapshark.com/redirect?dealID=${dealId}`
              : "https://www.cheapshark.com/",
            Math.min(90, savings),
            "CheapShark",
          );
        })
        .filter((p): p is Post => Boolean(p))
        .slice(0, PER_FEED);
    },
  },
  {
    name: "Jikan",
    category: "Anime",
    match: ["jikan", "myanimelist"],
    topicAware: true,
    run: async (_city, topic) => {
      const url = topic?.trim()
        ? `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(topic.trim())}&limit=10`
        : "https://api.jikan.moe/v4/top/anime?filter=airing&limit=10";
      const data = asRecord(await getJson(url));
      return asArray(data?.data)
        .map((row) => {
          const a = asRecord(row);
          const name = str(a?.title);
          if (!name) return null;
          return post(
            name,
            str(a?.url) || "https://myanimelist.net/",
            Math.min(95, num(a?.score) * 10),
            "Jikan",
          );
        })
        .filter((p): p is Post => Boolean(p))
        .slice(0, PER_FEED);
    },
  },
  {
    name: "Carbon Intensity",
    category: "Environment",
    match: ["carbon intensity"],
    run: async () => {
      const data = asRecord(await getJson("https://api.carbonintensity.org.uk/intensity"));
      const row = asRecord(asArray(data?.data)[0]);
      const intensity = asRecord(row?.intensity);
      if (!intensity) return [];
      return [
        post(
          `UK grid ${str(intensity.index)} (${num(intensity.actual) || num(intensity.forecast)} gCO₂/kWh)`,
          "https://carbonintensity.org.uk/",
          str(intensity.index) === "high" || str(intensity.index) === "very high" ? 75 : 40,
          "Carbon Intensity",
          str(row?.from) || undefined,
        ),
      ];
    },
  },
  {
    name: "iTunes",
    category: "Music",
    match: ["itunes", "apple"],
    topicAware: true,
    run: async (_city, topic) => {
      if (topic?.trim()) {
        const data = asRecord(
          await getJson(
            `https://itunes.apple.com/search?term=${encodeURIComponent(topic.trim())}&media=all&limit=${PER_FEED}`,
          ),
        );
        return asArray(data?.results)
          .map((row) => {
            const s = asRecord(row);
            if (!s) return null;
            const name = str(s.trackName) || str(s.collectionName);
            if (!name) return null;
            const artist = str(s.artistName);
            return post(
              artist ? `${name} — ${artist}` : name,
              str(s.trackViewUrl) || str(s.collectionViewUrl) || "https://music.apple.com/",
              55,
              "iTunes",
            );
          })
          .filter((p): p is Post => Boolean(p));
      }
      const data = asRecord(
        await getJson("https://rss.applemarketingtools.com/api/v2/us/music/most-played/10/songs.json"),
      );
      const feed = asRecord(data?.feed);
      return asArray(feed?.results)
        .map((row) => {
          const s = asRecord(row);
          const name = str(s?.name);
          if (!name) return null;
          return post(
            `${name} — ${str(s?.artistName)}`,
            str(s?.url) || "https://music.apple.com/",
            48,
            "iTunes",
          );
        })
        .filter((p): p is Post => Boolean(p))
        .slice(0, PER_FEED);
    },
  },
  {
    name: "Mastodon",
    category: "Social",
    match: ["mastodon"],
    run: async () => {
      const rows = asArray(await getJson("https://mastodon.social/api/v1/trends/tags?limit=10"));
      return rows
        .map((row) => {
          const t = asRecord(row);
          const name = str(t?.name);
          if (!name) return null;
          const uses = asArray(t?.history).reduce(
            (sum: number, h) => sum + num(asRecord(h)?.uses),
            0,
          );
          return post(
            `#${name.replace(/^#/, "")}`,
            `https://mastodon.social/tags/${encodeURIComponent(name)}`,
            Math.min(100, Math.log10(uses + 1) * 22),
            "Mastodon",
          );
        })
        .filter((p): p is Post => Boolean(p))
        .slice(0, PER_FEED);
    },
  },
  {
    name: "Lobsters",
    category: "Social",
    match: ["lobsters", "lobste.rs"],
    run: async () => {
      const rows = asArray(await getJson("https://lobste.rs/hottest.json"));
      return rows
        .map((row) => {
          const s = asRecord(row);
          if (!s || !str(s.title) || !str(s.url)) return null;
          return post(str(s.title), str(s.url), Math.min(100, num(s.score) * 4), "Lobsters");
        })
        .filter((p): p is Post => Boolean(p))
        .slice(0, PER_FEED);
    },
  },
  {
    name: "Open Food Facts",
    category: "Food & Drink",
    match: ["open food facts"],
    run: async () => {
      const data = asRecord(
        await getJson(
          "https://world.openfoodfacts.org/cgi/search.pl?action=process&sort_by=unique_scans_n&page_size=8&json=1&fields=product_name,code,url,unique_scans_n",
        ),
      );
      return asArray(data?.products)
        .map((row) => {
          const p = asRecord(row);
          const name = str(p?.product_name);
          if (!name) return null;
          return post(
            name,
            str(p?.url) || `https://world.openfoodfacts.org/product/${str(p?.code)}`,
            Math.min(80, num(p?.unique_scans_n) / 50),
            "Open Food Facts",
          );
        })
        .filter((p): p is Post => Boolean(p))
        .slice(0, PER_FEED);
    },
  },
  {
    name: "Nager.Date",
    category: "Calendar",
    match: ["nager.date", "nager"],
    run: async () => {
      const rows = asArray(await getJson("https://date.nager.at/api/v3/NextPublicHolidaysWorldwide"));
      return rows
        .slice(0, PER_FEED)
        .map((row) => {
          const h = asRecord(row);
          const name = str(h?.name);
          if (!name) return null;
          return post(
            `${str(h?.countryCode)} holiday: ${name}`,
            "https://date.nager.at/",
            30,
            "Nager.Date",
            str(h?.date) || undefined,
          );
        })
        .filter((p): p is Post => Boolean(p));
    },
  },
  {
    name: "CISA KEV",
    category: "Security",
    match: ["cisa"],
    run: async () => {
      const data = asRecord(
        await getJson(
          "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
        ),
      );
      return asArray(data?.vulnerabilities)
        .slice(0, PER_FEED)
        .map((row) => {
          const v = asRecord(row);
          const id = str(v?.cveID);
          const name = str(v?.vulnerabilityName);
          if (!id && !name) return null;
          return post(
            `${id} ${name}`.trim(),
            id ? `https://nvd.nist.gov/vuln/detail/${id}` : "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
            72,
            "CISA",
            str(v?.dateAdded) || undefined,
          );
        })
        .filter((p): p is Post => Boolean(p));
    },
  },
  {
    name: "Google News",
    category: "News",
    match: ["google news"],
    topicAware: true,
    run: async (_city, topic) => {
      if (topic?.trim()) {
        return parseRss(await getText(googleNewsRss(topic.trim())), "Google News");
      }
      return parseRss(
        await getText("https://news.google.com/rss/headlines/section/topic/WORLD?hl=en&gl=GB&ceid=GB:en"),
        "Google News",
      );
    },
  },
  {
    name: "BBC",
    category: "News",
    match: ["bbc"],
    topicAware: true,
    run: async (_city, topic) => {
      if (topic?.trim()) {
        return parseRss(await getText(googleNewsRss(`${topic.trim()} site:bbc.com`)), "BBC");
      }
      return parseRss(await getText("https://feeds.bbci.co.uk/news/world/rss.xml"), "BBC");
    },
  },
  {
    name: "Guardian",
    category: "News",
    match: ["guardian"],
    run: async () => parseRss(await getText("https://www.theguardian.com/world/rss"), "Guardian"),
  },
  {
    name: "Reuters",
    category: "News",
    match: ["reuters"],
    topicAware: true,
    run: async (_city, topic) =>
      parseRss(
        await getText(
          googleNewsRss(topic?.trim() ? `${topic.trim()} site:reuters.com` : "site:reuters.com when:1d"),
        ),
        "Reuters",
      ),
  },
  {
    name: "Al Jazeera",
    category: "News",
    match: ["al jazeera", "aljazeera"],
    topicAware: true,
    run: async (_city, topic) => {
      if (topic?.trim()) {
        return parseRss(await getText(googleNewsRss(`${topic.trim()} site:aljazeera.com`)), "Al Jazeera");
      }
      return parseRss(await getText("https://www.aljazeera.com/xml/rss/all.xml"), "Al Jazeera");
    },
  },
  {
    name: "NHK World",
    category: "News",
    match: ["nhk"],
    topicAware: true,
    run: async (_city, topic) =>
      parseRss(
        await getText(
          googleNewsRss(topic?.trim() ? `${topic.trim()} site:nhk.or.jp` : "site:nhk.or.jp when:1d"),
        ),
        "NHK World",
      ),
  },
  {
    name: "NYT",
    category: "News",
    match: ["new york times", "nytimes"],
    run: async () => parseRss(await getText("https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml"), "NYT"),
  },
  {
    name: "NPR",
    category: "News",
    match: ["npr"],
    run: async () => parseRss(await getText("https://feeds.npr.org/1001/rss.xml"), "NPR"),
  },
  {
    name: "TechCrunch",
    category: "Technology",
    match: ["techcrunch"],
    run: async () => parseRss(await getText("https://techcrunch.com/feed/"), "TechCrunch"),
  },
  {
    name: "arXiv",
    category: "Science & Math",
    match: ["arxiv"],
    topicAware: true,
    run: async (_city, topic) => {
      const q = topic?.trim() || "cat:cs.AI";
      return parseRss(
        await getText(
          `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&start=0&max_results=${PER_FEED}&sortBy=submittedDate&sortOrder=descending`,
        ),
        "arXiv",
      );
    },
  },
  {
    name: "ReliefWeb",
    category: "Government",
    match: ["reliefweb"],
    topicAware: true,
    run: async (_city, topic) => {
      const q = topic?.trim();
      const url = q
        ? `https://api.reliefweb.int/v1/reports?appname=hawkxai&limit=${PER_FEED}&sort[]=date:desc&query[value]=${encodeURIComponent(q)}`
        : `https://api.reliefweb.int/v1/reports?appname=hawkxai&limit=${PER_FEED}&sort[]=date:desc`;
      const data = asRecord(await getJson(url));
      return asArray(data?.data)
        .map((row) => {
          const r = asRecord(row);
          const fields = asRecord(r?.fields);
          const title = str(fields?.title);
          if (!title) return null;
          return post(title, "https://reliefweb.int/", 65, "ReliefWeb");
        })
        .filter((p): p is Post => Boolean(p));
    },
  },
  {
    name: "Fear & Greed",
    category: "Cryptocurrency",
    match: ["alternative.me", "fear"],
    run: async () => {
      const data = asRecord(await getJson("https://api.alternative.me/fng/?limit=1"));
      const row = asRecord(asArray(data?.data)[0]);
      const value = str(row?.value);
      const label = str(row?.value_classification);
      if (!value && !label) return [];
      return [
        post(
          `Crypto Fear & Greed ${label} (${value})`,
          "https://alternative.me/crypto/fear-and-greed-index/",
          Math.max(20, num(value)),
          "Fear & Greed",
        ),
      ];
    },
  },
  {
    name: "DuckDuckGo",
    category: "Open Data",
    match: ["duckduckgo"],
    topicAware: true,
    run: async (_city, topic) => {
      const q = topic?.trim();
      if (!q) return [];
      const data = asRecord(
        await getJson(
          `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`,
        ),
      );
      const posts: Post[] = [];
      const heading = str(data?.Heading);
      const abs = str(data?.AbstractText);
      const absUrl = str(data?.AbstractURL);
      if (heading && absUrl) {
        posts.push(post(abs ? `${heading}: ${abs.slice(0, 120)}` : heading, absUrl, 70, "DuckDuckGo"));
      }
      for (const row of asArray(data?.RelatedTopics)) {
        const t = asRecord(row);
        const text = str(t?.Text);
        const url = str(t?.FirstURL);
        if (!text || !url) continue;
        posts.push(post(text.slice(0, 180), url, 50, "DuckDuckGo"));
        if (posts.length >= PER_FEED) break;
      }
      if (!posts.length) throw new Error("DuckDuckGo empty");
      return posts;
    },
  },
  {
    name: "Stack Overflow",
    category: "Development",
    match: ["stackexchange", "stackoverflow"],
    topicAware: true,
    run: async (_city, topic) => {
      const q = topic?.trim();
      const url = q
        ? `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(q)}&site=stackoverflow&pagesize=${PER_FEED}`
        : `https://api.stackexchange.com/2.3/questions?order=desc&sort=hot&site=stackoverflow&pagesize=${PER_FEED}`;
      const data = asRecord(await getJson(url));
      return asArray(data?.items)
        .map((row) => {
          const i = asRecord(row);
          const title = str(i?.title);
          if (!title) return null;
          return post(
            title,
            str(i?.link) || "https://stackoverflow.com/",
            Math.min(100, num(i?.score) + 20),
            "Stack Overflow",
          );
        })
        .filter((p): p is Post => Boolean(p));
    },
  },
  {
    name: "OpenAlex",
    category: "Science & Math",
    match: ["openalex"],
    topicAware: true,
    run: async (_city, topic) => {
      const q = topic?.trim() || "artificial intelligence";
      const data = asRecord(
        await getJson(`https://api.openalex.org/works?search=${encodeURIComponent(q)}&per_page=${PER_FEED}`),
      );
      return asArray(data?.results)
        .map((row) => {
          const w = asRecord(row);
          const title = str(w?.display_name);
          if (!title) return null;
          const href = str(w?.id) || "https://openalex.org/";
          return post(title, href, 55, "OpenAlex");
        })
        .filter((p): p is Post => Boolean(p));
    },
  },
  {
    name: "CoinCap",
    category: "Cryptocurrency",
    match: ["coincap"],
    topicAware: true,
    run: async (_city, topic) => {
      const data = asRecord(await getJson("https://api.coincap.io/v2/assets?limit=20"));
      const rows = asArray(data?.data);
      const q = topic?.trim().toLowerCase();
      const picked = q
        ? rows.filter((row) => {
            const a = asRecord(row);
            return `${str(a?.id)} ${str(a?.symbol)} ${str(a?.name)}`.toLowerCase().includes(q);
          })
        : rows;
      const use = (picked.length ? picked : rows).slice(0, PER_FEED);
      return use
        .map((row) => {
          const a = asRecord(row);
          const name = str(a?.name);
          if (!name) return null;
          const change = num(a?.changePercent24Hr);
          return post(
            `${name} $${num(a?.priceUsd).toFixed(2)} (${change.toFixed(1)}%)`,
            `https://coincap.io/assets/${str(a?.id)}`,
            Math.min(100, Math.abs(change) * 8 + 20),
            "CoinCap",
          );
        })
        .filter((p): p is Post => Boolean(p));
    },
  },
  {
    name: "CryptoCompare",
    category: "Cryptocurrency",
    match: ["cryptocompare"],
    run: async () => {
      const data = asRecord(await getJson("https://min-api.cryptocompare.com/data/v2/news/?lang=EN"));
      return asArray(data?.Data)
        .slice(0, PER_FEED)
        .map((row) => {
          const n = asRecord(row);
          const title = str(n?.title);
          if (!title) return null;
          const ts = num(n?.published_on);
          return post(
            title,
            str(n?.url) || "https://www.cryptocompare.com/news/",
            52,
            "CryptoCompare",
            ts ? new Date(ts * 1000).toISOString() : undefined,
          );
        })
        .filter((p): p is Post => Boolean(p));
    },
  },
  {
    name: "Bluesky",
    category: "Social",
    match: ["bluesky", "bsky"],
    topicAware: true,
    run: async (_city, topic) => blueskyPosts(topic),
  },
  {
    name: "Federal Register",
    category: "Government",
    match: ["federal register"],
    topicAware: true,
    run: async (_city, topic) => {
      const q = topic?.trim();
      const url = q
        ? `https://www.federalregister.gov/api/v1/documents.json?conditions[term]=${encodeURIComponent(q)}&per_page=${PER_FEED}`
        : `https://www.federalregister.gov/api/v1/documents.json?per_page=${PER_FEED}&order=newest`;
      const data = asRecord(await getJson(url));
      return asArray(data?.results)
        .map((row) => {
          const d = asRecord(row);
          const title = str(d?.title);
          const href = str(d?.html_url);
          if (!title || !href) return null;
          return post(title, href, 58, "Federal Register", str(d?.publication_date) || undefined);
        })
        .filter((p): p is Post => Boolean(p))
        .slice(0, PER_FEED);
    },
  },
  {
    name: "NHTSA",
    category: "Vehicle",
    match: ["nhtsa"],
    topicAware: true,
    include: (topic) => Boolean(topic && vehicleQuery(topic)),
    run: async (_city, topic) => {
      const v = vehicleQuery(topic || "");
      if (!v) return [];
      const year = v.year || "2024";
      const data = asRecord(
        await getJson(
          `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(v.make)}&model=${encodeURIComponent(v.model)}&modelYear=${encodeURIComponent(year)}`,
        ),
      );
      return asArray(data?.results)
        .map((row) => {
          const r = asRecord(row);
          const id = str(r?.NHTSACampaignNumber);
          const component = str(r?.Component);
          const title = [id && `Recall ${id}`, component, str(r?.Manufacturer)]
            .filter(Boolean)
            .join(" · ");
          if (!title) return null;
          return post(
            title,
            id ? `https://www.nhtsa.gov/recalls?nhtsaId=${encodeURIComponent(id)}` : "https://www.nhtsa.gov/recalls",
            70,
            "NHTSA",
            str(r?.ReportReceivedDate) || undefined,
          );
        })
        .filter((p): p is Post => Boolean(p))
        .slice(0, PER_FEED);
    },
  },
  {
    name: "YouTube",
    category: "Video",
    match: ["youtube"],
    topicAware: true,
    include: () => Boolean(youtubeKey()),
    run: async (city, topic) => {
      const key = youtubeKey();
      if (!key) return [];
      const q = topic?.trim();
      if (q) {
        return youtubeItems(
          await getJson(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${PER_FEED}&q=${encodeURIComponent(q)}&key=${encodeURIComponent(key)}`,
          ),
        ).slice(0, PER_FEED);
      }
      const settled = await Promise.allSettled(
        youtubeRegions(city).map((region) =>
          getJson(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&regionCode=${region}&maxResults=${PER_FEED}&key=${encodeURIComponent(key)}`,
          ),
        ),
      );
      const seen = new Set<string>();
      const posts: Post[] = [];
      for (const item of settled) {
        if (item.status !== "fulfilled") continue;
        for (const p of youtubeItems(item.value)) {
          if (seen.has(p.url)) continue;
          seen.add(p.url);
          posts.push(p);
        }
      }
      return posts.slice(0, PER_FEED);
    },
  },
];

export function publicApiFeedNames(): string[] {
  return FEEDS.map((f) => f.name);
}

function selectFeeds(topic?: string, enabledSources?: string[]): Feed[] {
  const q = topic?.trim();
  let available = FEEDS.filter((f) => !f.include || f.include(q));
  available = filterByEnabledSources(available, enabledSources);
  
  const names = available.map((f) => f.name);
  const core = q
    ? available.filter((f) => f.topicAware).map((f) => f.name)
    : CORE_TAPE.filter((n) => names.includes(n));
  const budget = q ? TOPIC_FEED_BUDGET : DEFAULT_FEED_BUDGET;
  const picked = new Set<string>([...core, ...pickFeeds(names, budget)]);
  const selected = available.filter((f) => picked.has(f.name));
  const extras = selected.filter((f) => !core.includes(f.name));
  return [...available.filter((f) => core.includes(f.name)), ...extras].slice(
    0,
    Math.max(core.length, budget),
  );
}

export async function collectPublicApis(
  city: CityId = "all",
  topic?: string,
  enabledSources?: string[],
): Promise<PublicApiCollect> {
  let catalog: PublicApiEntry[] | null = null;
  try {
    catalog = await loadPublicApiCatalog();
  } catch (err) {
    console.warn("[public-apis] catalog failed", err instanceof Error ? err.message : err);
  }

  const open = catalog?.filter((e) => noAuth(e.auth) && e.https) ?? [];
  const q = topic?.trim() || undefined;
  const feeds = selectFeeds(q, enabledSources);
  recordPulls(feeds.map((f) => f.name));
  const settled = await Promise.allSettled(feeds.map((f) => f.run(city, q)));
  const posts: Post[] = [];
  const liveNames: string[] = [];
  const categories = new Set<string>();
  const feedStats: PublicApiFeedStat[] = [];

  settled.forEach((item, i) => {
    const feed = feeds[i];
    if (item.status !== "fulfilled") {
      console.warn(`[public-apis] ${feed.name} fail`, item.reason);
      feedStats.push({ name: feed.name, category: feed.category, posts: 0 });
      return;
    }
    const chunk = item.value.slice(0, PER_FEED);
    feedStats.push({ name: feed.name, category: feed.category, posts: chunk.length });
    if (!chunk.length) return;
    liveNames.push(feed.name);
    categories.add(feed.category);
    posts.push(...chunk);
  });

  const ingest: PublicApiIngest = {
    catalog: catalog?.length ?? 0,
    live: liveNames.length,
    attempted: feeds.length,
    categories: [...categories],
    sources: liveNames,
    feeds: feedStats.toSorted((a, b) => b.posts - a.posts),
    topic: q,
  };
  console.log(
    `[public-apis] catalog=${ingest.catalog} open=${open.length} live=${ingest.live}/${ingest.attempted} posts=${posts.length}${q ? ` topic="${q}"` : ""}${enabledSources ? ` filtered=${enabledSources.length}` : ""}`,
  );
  return { posts: posts.slice(0, MAX_POSTS), ingest };
}
