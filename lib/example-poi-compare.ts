import {
  INDUSTRY_CONSTRAINTS,
  INDUSTRY_FACTORS,
  INDUSTRY_VARIABLES,
} from "./insights-analysis";
import { EXAMPLE_POI_DATASET, EXAMPLE_POI_LICENSE, type ExamplePoiPlace } from "./example-poi";
import { industryOutlookFromHours, recordIndustryHour } from "./example-poi-series";
import { confidenceOf, outlookFromScores } from "./predict";
import { examplePinId, postGeo, receiptPinId } from "./trend-geo";
import type {
  ExamplePoiCompare,
  ExamplePoiIndustry,
  ExamplePoiIndustryCall,
  ExamplePoiPair,
  ForecastOutlook,
  Post,
} from "./types";
import type { IndustryConstraint, IndustryFactor, IndustryVariable } from "./insights-types";

/** Pair live tape with an example POI only inside this radius. Not a geocode. */
export const PAIR_KM = 400;

const HAZARD_RE = /usgs|eonet|quake|wildfire|volcano|storm/i;
const WEATHER_RE = /meteo|weather|nws|open-meteo/i;

const CAT_INDUSTRY: Record<string, ExamplePoiIndustry> = {
  museum: "entertainment",
  theatre: "entertainment",
  "opera-house": "entertainment",
  attraction: "entertainment",
  "amusement-park": "entertainment",
  zoo: "entertainment",
  statue: "entertainment",
  monument: "entertainment",
  memorial: "entertainment",
  stadium: "entertainment",
  ship: "entertainment",
  fountain: "entertainment",
  "archaeological-site": "entertainment",
  restaurant: "hospitality",
  park: "hospitality",
  garden: "hospitality",
  "botanical-garden": "hospitality",
  beach: "hospitality",
  square: "hospitality",
  waterfall: "hospitality",
  lake: "hospitality",
  cave: "hospitality",
  mountain: "hospitality",
  island: "hospitality",
  canal: "hospitality",
  church: "hospitality",
  cathedral: "hospitality",
  mosque: "hospitality",
  temple: "hospitality",
  monastery: "hospitality",
  synagogue: "hospitality",
  "shinto-shrine": "hospitality",
  "religious-site": "hospitality",
  cemetery: "hospitality",
  university: "education",
  library: "education",
  market: "retail",
  building: "real-estate",
  palace: "real-estate",
  tower: "real-estate",
  castle: "real-estate",
  fortification: "real-estate",
  "city-gate": "real-estate",
  neighbourhood: "real-estate",
  town: "real-estate",
  village: "real-estate",
  locality: "real-estate",
  street: "real-estate",
  bridge: "real-estate",
  lighthouse: "real-estate",
};

function rad(n: number): number {
  return (n * Math.PI) / 180;
}

export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6371;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function industryOf(place: Pick<ExamplePoiPlace, "name" | "category">): ExamplePoiIndustry {
  const hay = `${place.name} ${place.category}`.toLowerCase();
  if (/\bairport|airfield|terminal\b/.test(hay)) return "hospitality";
  if (/\bhospital|clinic|medical\b/.test(hay)) return "healthcare";
  if (/\bbank|exchange|bourse\b/.test(hay)) return "finance";
  if (/\buniversity|college|library\b/.test(hay)) return "education";
  if (/\bmall|market|bazaar\b/.test(hay)) return "retail";
  return CAT_INDUSTRY[place.category] ?? "entertainment";
}

export function pairExamplePoi(
  places: ExamplePoiPlace[],
  located: Post[],
  radiusKm = PAIR_KM,
): ExamplePoiPair[] {
  const pairs: ExamplePoiPair[] = [];
  for (const post of located) {
    const geo = postGeo(post);
    if (!geo) continue;
    let best: { place: ExamplePoiPlace; km: number } | null = null;
    for (const place of places) {
      const km = haversineKm(geo, place);
      if (km > radiusKm) continue;
      if (!best || km < best.km) best = { place, km };
    }
    if (!best) continue;
    pairs.push({
      poiId: best.place.id,
      poiName: best.place.name,
      poiCity: best.place.city,
      industry: industryOf(best.place),
      liveTitle: post.title,
      liveUrl: post.url,
      liveSource: post.sourceApi || post.platform,
      km: Math.round(best.km * 10) / 10,
      poiLat: best.place.lat,
      poiLon: best.place.lon,
      liveLat: geo.lat,
      liveLon: geo.lon,
      examplePinId: examplePinId(best.place.lat, best.place.lon),
      livePinId: receiptPinId(geo.lat, geo.lon),
    });
  }
  return pairs.toSorted((a, b) => a.km - b.km);
}

function locationScore(nearestKm: number | null, liveNear: number): number {
  if (nearestKm == null || liveNear === 0) return 0;
  if (nearestKm < 50) return 92;
  if (nearestKm < 150) return 78;
  if (nearestKm < 300) return 62;
  return 44;
}

function measuredFactors(
  category: ExamplePoiIndustry,
  liveNear: number,
  nearestKm: number | null,
  hazardNear: number,
): IndustryFactor[] {
  const names = INDUSTRY_FACTORS[category];
  const loc = locationScore(nearestKm, liveNear);
  const heat = Math.min(100, liveNear * 18);
  const safety = Math.max(8, 88 - hazardNear * 22);
  return names.map((name, index) => {
    const key = name.toLowerCase();
    let value = loc;
    if (/safety|risk|compliance|quality|health/.test(key)) value = safety;
    else if (/demand|engagement|occupancy|volume|adoption|interest/.test(key)) value = heat;
    else if (/location|appeal|presence/.test(key)) value = loc;
    const trend: IndustryFactor["trend"] =
      hazardNear > 0 && /safety|risk/.test(key) ? "down" : liveNear >= 2 ? "up" : "stable";
    return {
      id: `${category}-factor-${index}`,
      name,
      weight: (names.length - index) / names.length,
      value: Math.round(value * 10) / 10,
      unit: name.includes("Rate") || name.includes("Ratio") ? "%" : "index",
      trend,
    };
  });
}

function measuredConstraints(
  category: ExamplePoiIndustry,
  liveNear: number,
  nearestKm: number | null,
  hazardNear: number,
): IndustryConstraint[] {
  const names = INDUSTRY_CONSTRAINTS[category];
  const loc = locationScore(nearestKm, liveNear);
  return names.map((name, index) => {
    const key = name.toLowerCase();
    const threshold = 55;
    let current = loc;
    if (/safety|health|risk|emissions|compliance|regulatory/.test(key)) {
      current = Math.max(0, 90 - hazardNear * 28);
    } else if (/capacity|inventory|liquidity|funding|enrollment/.test(key)) {
      current = Math.min(100, liveNear * 22);
    } else if (/location|zoning|distribution/.test(key)) {
      current = loc;
    }
    const impact: IndustryConstraint["impact"] =
      index === 0 ? "critical" : index === 1 ? "high" : index === 2 ? "medium" : "low";
    return {
      id: `${category}-constraint-${index}`,
      name,
      threshold,
      current: Math.round(current * 10) / 10,
      met: current >= threshold,
      impact,
    };
  });
}

function measuredVariables(
  category: ExamplePoiIndustry,
  liveNear: number,
  nearestKm: number | null,
  dominant: string,
  hazardNear: number,
): IndustryVariable[] {
  const names = INDUSTRY_VARIABLES[category];
  return names.map((name, index) => {
    const type = (["numeric", "boolean", "categorical"] as const)[index % 3];
    let value: string | number | boolean;
    if (type === "numeric") value = liveNear;
    else if (type === "boolean") value = hazardNear > 0;
    else value = dominant || "none";
    return {
      id: `${category}-var-${index}`,
      name,
      type,
      value,
      impact: Math.min(1, 0.35 + liveNear * 0.12 + (nearestKm != null && nearestKm < 80 ? 0.2 : 0)),
    };
  });
}

function industryOutlook(liveNear: number, hazardNear: number): ForecastOutlook {
  if (liveNear < 1) return "thin";
  if (hazardNear >= 2) return outlookFromScores(1, hazardNear + 1, "topic");
  if (liveNear >= 3) return "peaking";
  if (liveNear === 2) return "rising";
  return "stable";
}

function industryPrediction(
  category: ExamplePoiIndustry,
  liveNear: number,
  nearestKm: number | null,
  hazardNear: number,
  weatherNear: number,
  nearestName: string | null,
): ExamplePoiIndustryCall["prediction"] {
  const conf = confidenceOf(liveNear, liveNear < 2);
  if (liveNear < 1) {
    return {
      headline: `No live tape near ${category} example POI`,
      nextAction: "Wait for a located public receipt inside 400 km before calling this industry.",
      timeframe: "Need a pair",
      confidence: 0,
    };
  }
  if (hazardNear > 0) {
    return {
      headline: `Hazard tape within ${nearestKm ?? "—"} km of ${nearestName ?? category}`,
      nextAction: `${category} constraint: treat Safety as unmet until USGS/EONET cools.`,
      timeframe: "This collect window",
      confidence: conf,
    };
  }
  if (weatherNear > 0 && (category === "hospitality" || category === "entertainment")) {
    return {
      headline: `Weather tape sitting on ${category} example POI`,
      nextAction: `Occupancy/location variables move with the live station — ${weatherNear} weather receipt${weatherNear === 1 ? "" : "s"} paired.`,
      timeframe: "Next 6–12h weather window",
      confidence: conf,
    };
  }
  return {
    headline: `${liveNear} live receipt${liveNear === 1 ? "" : "s"} within ${nearestKm ?? "—"} km of ${category}`,
    nextAction: `Read the paired source before spending. ${category} variables are measured from this tape only.`,
    timeframe: "This collect window",
    confidence: conf,
  };
}

function callIndustry(
  category: ExamplePoiIndustry,
  pairs: ExamplePoiPair[],
): ExamplePoiIndustryCall {
  const liveUrls = new Set(pairs.map((p) => p.liveUrl));
  const poiIds = new Set(pairs.map((p) => p.poiId));
  const nearest = pairs[0] ?? null;
  const nearestKm = nearest?.km ?? null;
  const sources = [...new Set(pairs.map((p) => p.liveSource))];
  const hazardNear = pairs.filter((p) => HAZARD_RE.test(p.liveSource) || HAZARD_RE.test(p.liveTitle)).length;
  const weatherNear = pairs.filter((p) => WEATHER_RE.test(p.liveSource) || WEATHER_RE.test(p.liveTitle)).length;
  const liveNear = liveUrls.size;
  const snapshotOutlook = industryOutlook(liveNear, hazardNear);
  const thin = liveNear < 2;
  const analysis = thin
    ? liveNear === 0
      ? `No public receipt within ${PAIR_KM} km of a ${category} example POI. Thin — no industry call.`
      : `1 live pair for ${category} (${nearest?.poiName ?? "POI"} · ${nearestKm} km · ${nearest?.liveSource ?? "public"}). Need 2 before a next-window.`
    : `${category}: ${liveNear} live receipts × ${poiIds.size} example POI · nearest ${nearestKm} km (${nearest?.poiName}) · ${sources.join(", ")}`;

  return {
    category,
    poiCount: poiIds.size,
    liveNear,
    nearestKm,
    sources,
    factors: measuredFactors(category, liveNear, nearestKm, hazardNear),
    constraints: measuredConstraints(category, liveNear, nearestKm, hazardNear),
    variables: measuredVariables(category, liveNear, nearestKm, sources[0] ?? "", hazardNear),
    outlook: snapshotOutlook,
    confidence: confidenceOf(liveNear, thin),
    thin,
    analysis,
    window: [liveNear],
    prediction: industryPrediction(category, liveNear, nearestKm, hazardNear, weatherNear, nearest?.poiName ?? null),
  };
}

export function compareExamplePoi(
  places: ExamplePoiPlace[],
  located: Post[],
  meta: { collectedAt: string; datasetSha: string | null; liveRefresh?: "hub" | "sample" },
): ExamplePoiCompare {
  const pairs = pairExamplePoi(places, located);
  const byIndustry = new Map<ExamplePoiIndustry, ExamplePoiPair[]>();
  for (const pair of pairs) {
    const list = byIndustry.get(pair.industry) ?? [];
    list.push(pair);
    byIndustry.set(pair.industry, list);
  }
  let industries = [...byIndustry.entries()]
    .map(([category, rows]) => callIndustry(category, rows.toSorted((a, b) => a.km - b.km)))
    .toSorted((a, b) => b.liveNear - a.liveNear || (a.nearestKm ?? 999) - (b.nearestKm ?? 999));

  const thin = pairs.length < 2;
  const liveRefresh = meta.liveRefresh ?? "sample";
  const analysis = thin
    ? pairs.length === 0
      ? `Example POI loaded (${places.length} Hugging Face places). No live public receipt within ${PAIR_KM} km — compare stays thin.`
      : `1 pair only (${pairs[0]?.poiName} · ${pairs[0]?.km} km · ${pairs[0]?.liveSource}). Need 2 before an industry next-window.`
    : `${pairs.length} live×example pairs · ${industries.length} industr${industries.length === 1 ? "y" : "ies"} with a receipt inside ${PAIR_KM} km`;

  const report: ExamplePoiCompare = {
    dataset: EXAMPLE_POI_DATASET,
    license: EXAMPLE_POI_LICENSE,
    collectedAt: meta.collectedAt,
    datasetSha: meta.datasetSha,
    exampleCount: places.length,
    locatedCount: located.length,
    pairCount: pairs.length,
    pairs: pairs.slice(0, 12),
    industries,
    thin,
    analysis,
    liveRefresh,
  };
  recordIndustryHour(report);
  industries = industries.map((row) => {
    const { outlook, window } = industryOutlookFromHours(row.category, row.liveNear);
    if (window.length < 2) return { ...row, window };
    const seriesThin = outlook === "thin";
    return {
      ...row,
      outlook,
      window,
      thin: seriesThin && row.liveNear < 2,
      analysis: `${row.analysis} · hours ${window.join("→")}`,
      prediction: {
        ...row.prediction,
        timeframe: window.length >= 2 ? `${window.length} hourly snaps` : row.prediction.timeframe,
      },
    };
  });
  report.industries = industries;
  return report;
}
