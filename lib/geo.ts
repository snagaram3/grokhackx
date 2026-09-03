export interface CitySpec {
  label: string;
  sub: string;
  lat: number;
  lon: number;
  yt: string;
  tv: string;
}

export const CITIES = {
  london: { label: "London", sub: "london", lat: 51.51, lon: -0.13, yt: "GB", tv: "GB" },
  tokyo: { label: "Tokyo", sub: "tokyo", lat: 35.68, lon: 139.69, yt: "JP", tv: "JP" },
  mumbai: { label: "Mumbai", sub: "mumbai", lat: 19.08, lon: 72.88, yt: "IN", tv: "IN" },
  lagos: { label: "Lagos", sub: "Nigeria", lat: 6.52, lon: 3.38, yt: "NG", tv: "NG" },
  saopaulo: { label: "São Paulo", sub: "brasil", lat: -23.55, lon: -46.63, yt: "BR", tv: "BR" },
  sydney: { label: "Sydney", sub: "sydney", lat: -33.87, lon: 151.21, yt: "AU", tv: "AU" },
  cairo: { label: "Cairo", sub: "egypt", lat: 30.04, lon: 31.24, yt: "EG", tv: "EG" },
  berlin: { label: "Berlin", sub: "berlin", lat: 52.52, lon: 13.4, yt: "DE", tv: "DE" },
  singapore: { label: "Singapore", sub: "singapore", lat: 1.35, lon: 103.82, yt: "SG", tv: "SG" },
  seoul: { label: "Seoul", sub: "korea", lat: 37.57, lon: 126.98, yt: "KR", tv: "KR" },
  mexicocity: { label: "Mexico City", sub: "mexico", lat: 19.43, lon: -99.13, yt: "MX", tv: "MX" },
  nairobi: { label: "Nairobi", sub: "Kenya", lat: -1.29, lon: 36.82, yt: "KE", tv: "KE" },
  jakarta: { label: "Jakarta", sub: "indonesia", lat: -6.21, lon: 106.85, yt: "ID", tv: "ID" },
  toronto: { label: "Toronto", sub: "toronto", lat: 43.65, lon: -79.38, yt: "CA", tv: "CA" },
  dubai: { label: "Dubai", sub: "dubai", lat: 25.2, lon: 55.27, yt: "AE", tv: "AE" },
  paris: { label: "Paris", sub: "paris", lat: 48.86, lon: 2.35, yt: "FR", tv: "FR" },
  nyc: { label: "NYC", sub: "nyc", lat: 40.71, lon: -74.01, yt: "US", tv: "US" },
  sf: { label: "San Francisco", sub: "sanfrancisco", lat: 37.77, lon: -122.42, yt: "US", tv: "US" },
  austin: { label: "Austin", sub: "Austin", lat: 30.27, lon: -97.74, yt: "US", tv: "US" },
} as const satisfies Record<string, CitySpec>;

export type CityId = "all" | keyof typeof CITIES;

export interface GeoQuery {
  city: CityId;
  label: string | null;
  redditSubs: string[];
  log: string;
}

/** World tape — not a US tech/finance bubble. */
export const WORLD_REDDIT = [
  "worldnews",
  "news",
  "technology",
  "wallstreetbets",
  "europe",
  "india",
  "japan",
  "australia",
  "brasil",
  "Nigeria",
];

const ALIAS: Record<string, CityId> = {
  all: "all",
  world: "all",
  global: "all",
  worldwide: "all",
  "sao paulo": "saopaulo",
  "são paulo": "saopaulo",
  "mexico city": "mexicocity",
  "new york": "nyc",
  "new york city": "nyc",
  "san francisco": "sf",
  "san fran": "sf",
};

export const CITY_OPTIONS: { id: CityId; label: string }[] = [
  { id: "all", label: "World" },
  ...(Object.keys(CITIES) as Exclude<CityId, "all">[]).map((id) => ({
    id,
    label: CITIES[id].label,
  })),
];

export const PLACE_NEEDLES: string[] = [
  ...new Set(
    (Object.keys(CITIES) as Exclude<CityId, "all">[]).flatMap((id) => [
      id,
      CITIES[id].label.toLowerCase(),
      CITIES[id].sub.toLowerCase(),
    ]),
  ),
  "sao paulo",
  "são paulo",
  "mexico city",
  "new york",
  "new york city",
  "san francisco",
  "san fran",
];

export function parseCity(raw?: string | null): CityId {
  const key = (raw ?? "all").trim().toLowerCase();
  if (key in CITIES) return key as Exclude<CityId, "all">;
  return ALIAS[key] ?? "all";
}

/** Place filter near-box in km (receipt coords only — never a title geocode). */
export const PLACE_NEAR_KM = 450;

function placeHaversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function nearPlaceFilter(lat: number, lon: number, city: CityId): boolean {
  if (city === "all") return true;
  const spec = CITIES[city];
  return placeHaversineKm(lat, lon, spec.lat, spec.lon) <= PLACE_NEAR_KM;
}

/** Rewrite collection queries for a city. No maps API, no geocoding. */
export function geoAgent(raw?: string | null): GeoQuery {
  const city = parseCity(raw);

  if (city === "all") {
    return {
      city,
      label: null,
      redditSubs: [...WORLD_REDDIT],
      log: "geo: world",
    };
  }
  const spec = CITIES[city];
  return {
    city,
    label: spec.label,
    redditSubs: [...WORLD_REDDIT, spec.sub],
    log: `geo: ${city} r/${spec.sub}+world`,
  };
}

export function weatherSpots(city: CityId): { lat: number; lon: number; label: string }[] {
  if (city === "all") {
    return (Object.keys(CITIES) as Exclude<CityId, "all">[]).map((id) => ({
      lat: CITIES[id].lat,
      lon: CITIES[id].lon,
      label: CITIES[id].label,
    }));
  }
  const spec = CITIES[city];
  return [{ lat: spec.lat, lon: spec.lon, label: spec.label }];
}

export function youtubeRegions(city: CityId): string[] {
  if (city === "all") return ["IN", "BR", "JP", "NG"];
  return [CITIES[city].yt];
}

export function tvCountry(city: CityId): string | null {
  if (city === "all") return null;
  return CITIES[city].tv;
}

export function trendsCacheKey(raw?: string | null, topic?: string | null): string {
  const city = geoAgent(raw).city;
  const t = (topic ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return t ? `trends:v2:${city}:topic:${t}` : `trends:v2:${city}`;
}
