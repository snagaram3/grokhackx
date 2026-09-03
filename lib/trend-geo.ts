import { CITIES, nearPlaceFilter, type CityId } from "./geo";
import type { Post, PostGeo, Topic } from "./types";

export type TrendPinKind = "receipt" | "lens" | "example";

export interface TrendPin {
  id: string;
  lat: number;
  lon: number;
  label: string;
  kind: TrendPinKind;
  source: string;
  title: string;
  url: string;
  topicIds: string[];
  weight: number;
}

const LAT_RE = /(?:[?#&]latitude=)(-?\d+(?:\.\d+)?)/i;
const LON_RE = /(?:[?#&]longitude=)(-?\d+(?:\.\d+)?)/i;

export function validGeo(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

/** Read lat/lon the feed already wrote into the receipt URL. Not a geocoder. */
export function parseUrlGeo(url: string, label: string): PostGeo | null {
  const lat = Number(url.match(LAT_RE)?.[1]);
  const lon = Number(url.match(LON_RE)?.[1]);
  if (!validGeo(lat, lon)) return null;
  const name = label.trim().slice(0, 80);
  if (!name) return null;
  return { lat, lon, label: name };
}

export function postGeo(post: Post): PostGeo | null {
  if (post.geo && validGeo(post.geo.lat, post.geo.lon)) {
    return { lat: post.geo.lat, lon: post.geo.lon, label: post.geo.label || post.title };
  }
  return parseUrlGeo(post.url, post.geo?.label || post.title);
}

export function pinKey(lat: number, lon: number): string {
  return `${lat.toFixed(1)},${lon.toFixed(1)}`;
}

export function receiptPinId(lat: number, lon: number): string {
  return pinKey(lat, lon);
}

export function examplePinId(lat: number, lon: number): string {
  return `ex:${pinKey(lat, lon)}`;
}

function topicPosts(topic: Topic): Post[] {
  return Object.values(topic.platforms).flatMap((slice) => slice.posts);
}

function lensSpec(city: CityId): { lat: number; lon: number; label: string } | null {
  if (city === "all") return null;
  const spec = CITIES[city];
  return { lat: spec.lat, lon: spec.lon, label: spec.label };
}

function addPin(
  byKey: Map<string, TrendPin>,
  post: Post,
  topicId: string | null,
): void {
  const geo = postGeo(post);
  if (!geo) return;
  const id = pinKey(geo.lat, geo.lon);
  const prev = byKey.get(id);
  if (!prev) {
    byKey.set(id, {
      id,
      lat: geo.lat,
      lon: geo.lon,
      label: geo.label,
      kind: "receipt",
      source: post.sourceApi || post.platform,
      title: post.title,
      url: post.url,
      topicIds: topicId ? [topicId] : [],
      weight: post.score,
    });
    return;
  }
  if (topicId && !prev.topicIds.includes(topicId)) prev.topicIds.push(topicId);
  prev.weight += post.score;
  if (post.score > 0 && post.title.length < prev.title.length) {
    prev.title = post.title;
    prev.label = geo.label;
    prev.url = post.url;
    prev.source = post.sourceApi || post.platform;
  }
}

function addExamplePin(byKey: Map<string, TrendPin>, post: Post): void {
  const geo = postGeo(post);
  if (!geo) return;
  const id = examplePinId(geo.lat, geo.lon);
  if (byKey.has(id)) return;
  byKey.set(id, {
    id,
    lat: geo.lat,
    lon: geo.lon,
    label: geo.label,
    kind: "example",
    source: post.sourceApi || "HF:audiala-places",
    title: post.title,
    url: post.url,
    topicIds: [],
    weight: post.score,
  });
}

/** Pins from dated receipts with proven coordinates. Lens is the Place filter, not a trend. */
export function buildTrendPins(
  topics: Topic[],
  city: CityId = "all",
  extras: Post[] = [],
  examples: Post[] = [],
): TrendPin[] {
  const byKey = new Map<string, TrendPin>();

  for (const topic of topics) {
    for (const post of topicPosts(topic)) addPin(byKey, post, topic.id);
  }
  for (const post of extras) addPin(byKey, post, null);

  const receipts = [...byKey.values()].toSorted((a, b) => b.weight - a.weight).slice(0, 40);
  const exampleBy = new Map<string, TrendPin>();
  for (const post of examples) addExamplePin(exampleBy, post);
  // When a Place filter is on, keep nearby example POIs in the pin cap first.
  const examplePins = [...exampleBy.values()]
    .toSorted((a, b) => {
      if (city !== "all") {
        const an = nearPlaceFilter(a.lat, a.lon, city) ? 1 : 0;
        const bn = nearPlaceFilter(b.lat, b.lon, city) ? 1 : 0;
        if (an !== bn) return bn - an;
      }
      return b.weight - a.weight;
    })
    .slice(0, 36);

  const pins = [...receipts, ...examplePins];
  const lens = lensSpec(city);
  if (lens) {
    pins.unshift({
      id: `lens:${city}`,
      lat: lens.lat,
      lon: lens.lon,
      label: lens.label,
      kind: "lens",
      source: "place",
      title: `Place filter · ${lens.label}`,
      url: "",
      topicIds: [],
      weight: 0,
    });
  }
  return pins;
}

/** Public receipts that already have a place — even if clustering did not attach them. */
export function locatedReceipts(posts: Post[]): Post[] {
  const seen = new Set<string>();
  const out: Post[] = [];
  for (const post of posts) {
    if (!postGeo(post)) continue;
    if (seen.has(post.url)) continue;
    seen.add(post.url);
    out.push(post);
  }
  return out.toSorted((a, b) => b.score - a.score).slice(0, 40);
}
