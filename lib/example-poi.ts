import sample from "./data/example-poi.json";
import { cacheGet, cachePeek, cacheSet } from "./cache";
import { nearPlaceFilter, type CityId } from "./geo";
import { stampPosts } from "./lineage";
import { validGeo } from "./trend-geo";
import type { Post } from "./types";

export { nearPlaceFilter, PLACE_NEAR_KM } from "./geo";

export const EXAMPLE_POI_DATASET = "audiala/audiala-places";
export const EXAMPLE_POI_LICENSE = "cc-by-4.0";
export const EXAMPLE_POI_TOOL = "collect_huggingface_poi";
export const EXAMPLE_POI_SOURCE = "HF:audiala-places";

const HF_META = `https://huggingface.co/api/datasets/${EXAMPLE_POI_DATASET}`;
const HF_CSV =
  "https://huggingface.co/datasets/audiala/audiala-places/resolve/main/data/audiala-places.csv";
const CACHE_KEY = "example-poi:v1";
const META_MS = 6_000;
const LIVE_MS = 8_000;
const LIVE_TTL_MS = 6 * 60 * 60 * 1000;
const MIN_LIVE_PLACES = 24;
const LIVE_CAP = 96;

export interface ExamplePoiPlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
  country: string;
  iso2: string;
  city: string;
  category: string;
  sitelinks: number;
  pagerank: number;
  url: string;
}

export interface ExamplePoiCollect {
  places: ExamplePoiPlace[];
  posts: Post[];
  datasetSha: string | null;
  collectedAt: string;
  liveMeta: boolean;
  liveRefresh: "hub" | "sample";
}

function asPlace(row: ExamplePoiPlace): ExamplePoiPlace | null {
  if (!row.id || !row.name || !validGeo(row.lat, row.lon)) return null;
  const name = row.name.trim().slice(0, 80);
  if (!name) return null;
  return {
    id: row.id,
    name,
    lat: row.lat,
    lon: row.lon,
    country: row.country?.trim() ?? "",
    iso2: (row.iso2 ?? "").trim().toUpperCase(),
    city: row.city?.trim() ?? "",
    category: row.category?.trim() ?? "",
    sitelinks: Number.isFinite(row.sitelinks) ? row.sitelinks : 0,
    pagerank: Number.isFinite(row.pagerank) ? row.pagerank : 0,
    url: row.url || `https://www.wikidata.org/wiki/${row.id}`,
  };
}

/** Hugging Face travel POIs we already sampled — not a geocoder. */
export function loadExamplePoiSample(): ExamplePoiPlace[] {
  const out: ExamplePoiPlace[] = [];
  const seen = new Set<string>();
  for (const raw of sample as ExamplePoiPlace[]) {
    const place = asPlace(raw);
    if (!place || seen.has(place.id)) continue;
    seen.add(place.id);
    out.push(place);
  }
  return out;
}

export function placeToPost(place: ExamplePoiPlace, collectedAt: string): Post {
  const where = [place.city, place.country].filter(Boolean).join(", ");
  return {
    platform: "public",
    title: `Example POI · ${place.name}${place.category ? ` · ${place.category}` : ""}${where ? ` · ${where}` : ""}`,
    url: place.url,
    score: Math.max(1, Math.min(100, place.sitelinks)),
    createdAt: collectedAt,
    sourceApi: EXAMPLE_POI_SOURCE,
    geo: { lat: place.lat, lon: place.lon, label: place.name },
    tool: EXAMPLE_POI_TOOL,
    collectedAt,
  };
}

export function examplePoiPosts(places: ExamplePoiPlace[], collectedAt: string): Post[] {
  return stampPosts(
    places.map((place) => placeToPost(place, collectedAt)),
    EXAMPLE_POI_TOOL,
  );
}

function nearCity(place: ExamplePoiPlace, city: CityId): boolean {
  return nearPlaceFilter(place.lat, place.lon, city);
}

/** Keep world coverage; when a Place filter is on, float nearby example POIs first. */
export function selectExamplePoi(places: ExamplePoiPlace[], city: CityId = "all"): ExamplePoiPlace[] {
  if (city === "all") return places;
  const near = places.filter((p) => nearCity(p, city));
  const far = places.filter((p) => !nearCity(p, city));
  return [...near, ...far];
}

export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (c === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function col(header: string[], row: string[], name: string): string {
  const i = header.indexOf(name);
  return i >= 0 ? (row[i] ?? "").trim() : "";
}

export function placeFromCsvRow(header: string[], row: string[]): ExamplePoiPlace | null {
  const id = col(header, row, "wikidata_id");
  const name = col(header, row, "name_en");
  const lat = Number(col(header, row, "latitude"));
  const lon = Number(col(header, row, "longitude"));
  if (!id || !name || !validGeo(lat, lon)) return null;
  const sitelinks = Number(col(header, row, "sitelinks")) || 0;
  const pagerank = Number(col(header, row, "wikidata_pagerank")) || 0;
  return asPlace({
    id,
    name,
    lat,
    lon,
    country: col(header, row, "country_en"),
    iso2: col(header, row, "country_iso2"),
    city: col(header, row, "city_en"),
    category: col(header, row, "category"),
    sitelinks,
    pagerank,
    url: col(header, row, "url_en") || `https://www.wikidata.org/wiki/${id}`,
  });
}

function keepBest(bag: ExamplePoiPlace[], place: ExamplePoiPlace, cap: number): void {
  if (bag.length < cap) {
    bag.push(place);
    return;
  }
  let min = 0;
  for (let i = 1; i < bag.length; i++) {
    if ((bag[i]?.sitelinks ?? 0) < (bag[min]?.sitelinks ?? 0)) min = i;
  }
  if (place.sitelinks > (bag[min]?.sitelinks ?? 0)) bag[min] = place;
}

function finishSample(byCountry: Map<string, ExamplePoiPlace>, famous: ExamplePoiPlace[]): ExamplePoiPlace[] {
  const seen = new Set<string>();
  const out: ExamplePoiPlace[] = [];
  for (const place of [...byCountry.values(), ...famous.toSorted((a, b) => b.sitelinks - a.sitelinks)]) {
    if (seen.has(place.id)) continue;
    seen.add(place.id);
    out.push(place);
    if (out.length >= LIVE_CAP) break;
  }
  return out;
}

/** Stream the Hub CSV until timeout; keep country champions + famous leftovers. */
export async function streamHubPlaces(timeoutMs = LIVE_MS): Promise<ExamplePoiPlace[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const byCountry = new Map<string, ExamplePoiPlace>();
  const famous: ExamplePoiPlace[] = [];
  try {
    const res = await fetch(HF_CSV, {
      signal: ctrl.signal,
      headers: { Accept: "text/csv", "User-Agent": "HawkxAI-example-poi/1.0" },
    });
    if (!res.ok || !res.body) return [];
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let header: string[] | null = null;
    while (true) {
      const { done, value } = await reader.read();
      buf += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buf.split(/\r?\n/);
      buf = done ? "" : (lines.pop() ?? "");
      for (const line of lines) {
        if (!line) continue;
        if (!header) {
          header = splitCsvLine(line);
          continue;
        }
        const place = placeFromCsvRow(header, splitCsvLine(line));
        if (!place) continue;
        const prev = byCountry.get(place.iso2);
        if (!prev || place.sitelinks > prev.sitelinks) byCountry.set(place.iso2, place);
        keepBest(famous, place, 40);
      }
      if (done) break;
    }
  } catch {
    // Timeout or Hub miss — caller falls back to the vendored sample.
  } finally {
    clearTimeout(t);
  }
  return finishSample(byCountry, famous);
}

async function fetchDatasetSha(): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), META_MS);
    const res = await fetch(HF_META, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "HawkxAI-example-poi/1.0" },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const body = (await res.json()) as { sha?: string };
    return typeof body.sha === "string" && body.sha.length >= 7 ? body.sha : null;
  } catch {
    return null;
  }
}

let liveHold: { payload: ExamplePoiCollect; until: number } | null = null;

function packCollect(
  places: ExamplePoiPlace[],
  collectedAt: string,
  datasetSha: string | null,
  liveRefresh: "hub" | "sample",
): ExamplePoiCollect {
  return {
    places,
    posts: examplePoiPosts(places, collectedAt),
    datasetSha,
    collectedAt,
    liveMeta: Boolean(datasetSha),
    liveRefresh,
  };
}

function cityView(collect: ExamplePoiCollect, city: CityId): ExamplePoiCollect {
  const places = selectExamplePoi(collect.places, city);
  return { ...collect, places, posts: examplePoiPosts(places, collect.collectedAt) };
}

/** Example POI collect: live Hub CSV when it finishes in time, else the vendored sample. */
export async function collectExamplePoi(city: CityId = "all"): Promise<ExamplePoiCollect> {
  if (liveHold && Date.now() < liveHold.until) return cityView(liveHold.payload, city);
  const cached = cacheGet<ExamplePoiCollect>(CACHE_KEY);
  if (cached) return cityView(cached, city);

  const collectedAt = new Date().toISOString();
  const [hubPlaces, datasetSha] = await Promise.all([streamHubPlaces(), fetchDatasetSha()]);
  const liveRefresh: "hub" | "sample" = hubPlaces.length >= MIN_LIVE_PLACES ? "hub" : "sample";
  const places = liveRefresh === "hub" ? hubPlaces : loadExamplePoiSample();
  const payload = packCollect(places, collectedAt, datasetSha, liveRefresh);
  cacheSet(CACHE_KEY, payload);
  liveHold = { payload, until: Date.now() + (liveRefresh === "hub" ? LIVE_TTL_MS : 15 * 60 * 1000) };
  return cityView(payload, city);
}

export function peekExamplePoi(): ExamplePoiCollect | undefined {
  return cachePeek<ExamplePoiCollect>(CACHE_KEY);
}
