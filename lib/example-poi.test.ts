import assert from "node:assert/strict";
import { test } from "node:test";
import { compareExamplePoi, haversineKm, industryOf, pairExamplePoi } from "./example-poi-compare";
import {
  EXAMPLE_POI_SOURCE,
  EXAMPLE_POI_TOOL,
  loadExamplePoiSample,
  nearPlaceFilter,
  placeFromCsvRow,
  placeToPost,
  splitCsvLine,
} from "./example-poi";
import { resetIndustrySeries } from "./example-poi-series";
import { buildTrendPins, examplePinId, receiptPinId } from "./trend-geo";
import type { Post } from "./types";

const eiffel = {
  id: "Q243",
  name: "Eiffel Tower",
  lat: 48.85826,
  lon: 2.294501,
  country: "France",
  iso2: "FR",
  city: "Paris",
  category: "tower",
  sitelinks: 189,
  pagerank: 1,
  url: "https://audiala.com/en/france/paris/eiffel-tower",
};

test("industry map uses category and airport names — never a title geocode", () => {
  assert.equal(industryOf({ name: "Eiffel Tower", category: "tower" }), "real-estate");
  assert.equal(industryOf({ name: "Louvre Museum", category: "museum" }), "entertainment");
  assert.equal(industryOf({ name: "NUS", category: "university" }), "education");
  assert.equal(industryOf({ name: "Tan Son Nhat International Airport", category: "building" }), "hospitality");
});

test("HF sample stamps Example POI lineage and proven coords", () => {
  const places = loadExamplePoiSample();
  assert.ok(places.length >= 40);
  const post = placeToPost(places[0]!, "2026-08-30T00:00:00.000Z");
  assert.equal(post.tool, EXAMPLE_POI_TOOL);
  assert.equal(post.sourceApi, EXAMPLE_POI_SOURCE);
  assert.match(post.title, /^Example POI · /);
  assert.ok(post.geo);
});

test("pairs a Paris weather receipt with the Eiffel example POI", () => {
  const live: Post = {
    platform: "public",
    title: "Paris 18°C wind 3",
    url: "https://open-meteo.com/en/docs#latitude=48.86&longitude=2.35",
    score: 40,
    createdAt: "2026-08-30T00:00:00.000Z",
    sourceApi: "Open-Meteo",
    geo: { lat: 48.86, lon: 2.35, label: "Paris" },
  };
  const pairs = pairExamplePoi([eiffel], [live]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0]?.poiName, "Eiffel Tower");
  assert.ok((pairs[0]?.km ?? 99) < 10);
  assert.equal(pairs[0]?.industry, "real-estate");
  assert.equal(pairs[0]?.examplePinId, examplePinId(eiffel.lat, eiffel.lon));
  assert.equal(pairs[0]?.livePinId, receiptPinId(48.86, 2.35));
});

test("does not pair a Tokyo receipt with Paris example POI", () => {
  const live: Post = {
    platform: "public",
    title: "Tokyo 28°C",
    url: "https://open-meteo.com/en/docs#latitude=35.68&longitude=139.69",
    score: 40,
    createdAt: "2026-08-30T00:00:00.000Z",
    sourceApi: "Open-Meteo",
    geo: { lat: 35.68, lon: 139.69, label: "Tokyo" },
  };
  assert.equal(pairExamplePoi([eiffel], [live]).length, 0);
});

test("compare stays thin without live pairs and never invents a WHY", () => {
  resetIndustrySeries();
  const report = compareExamplePoi([eiffel], [], { collectedAt: "2026-08-30T00:00:00.000Z", datasetSha: null });
  assert.equal(report.thin, true);
  assert.equal(report.pairCount, 0);
  assert.match(report.analysis, /thin/i);
  assert.equal(report.industries.length, 0);
});

test("industry call collects variables and constraints from the paired tape", () => {
  resetIndustrySeries();
  const live: Post = {
    platform: "public",
    title: "M 5.1 - Île-de-France",
    url: "https://earthquake.usgs.gov/earthquakes/eventpage/us1",
    score: 80,
    createdAt: "2026-08-30T00:00:00.000Z",
    sourceApi: "USGS",
    geo: { lat: 48.86, lon: 2.35, label: "Paris" },
  };
  const report = compareExamplePoi([eiffel], [live], {
    collectedAt: "2026-08-30T00:00:00.000Z",
    datasetSha: "abc1234",
  });
  assert.equal(report.pairCount, 1);
  const row = report.industries[0];
  assert.ok(row);
  assert.equal(row.category, "real-estate");
  assert.ok(row.variables.length >= 3);
  assert.ok(row.constraints.length >= 3);
  assert.match(row.prediction.headline, /Hazard|live receipt/i);
});

test("example pins stay a separate kind from live receipts", () => {
  const pins = buildTrendPins(
    [],
    "all",
    [
      {
        platform: "public",
        title: "Paris 18°C",
        url: "https://open-meteo.com/en/docs#latitude=48.86&longitude=2.35",
        score: 40,
        createdAt: "2026-08-30T00:00:00.000Z",
        sourceApi: "Open-Meteo",
      },
    ],
    [placeToPost(eiffel, "2026-08-30T00:00:00.000Z")],
  );
  assert.equal(pins.filter((p) => p.kind === "receipt").length, 1);
  assert.equal(pins.filter((p) => p.kind === "example").length, 1);
  assert.ok(pins.some((p) => p.source === "HF:audiala-places"));
});

test("splitCsvLine keeps quoted commas", () => {
  assert.deepEqual(splitCsvLine('Q1,"Paris, FR",48.8,2.3'), ["Q1", "Paris, FR", "48.8", "2.3"]);
});

test("placeFromCsvRow reads proven Hub columns only", () => {
  const header = splitCsvLine("wikidata_id,name_en,latitude,longitude,country_iso2,country_en,city_en,category,sitelinks,url_en");
  const place = placeFromCsvRow(
    header,
    splitCsvLine("Q243,Eiffel Tower,48.85826,2.294501,FR,France,Paris,tower,189,https://audiala.com/en/france/paris/eiffel-tower"),
  );
  assert.equal(place?.id, "Q243");
  assert.equal(place?.name, "Eiffel Tower");
  assert.equal(placeFromCsvRow(header, splitCsvLine("Q1,Nowhere,91,0,FR,France,x,tower,1,https://x")), null);
});

test("hourly industry series turns a second snap into a next-window", () => {
  resetIndustrySeries();
  const live = (n: number): Post => ({
    platform: "public",
    title: `Paris ${n}°C`,
    url: `https://open-meteo.com/en/docs#latitude=48.86&longitude=2.35&n=${n}`,
    score: 40,
    createdAt: "2026-08-30T00:00:00.000Z",
    sourceApi: "Open-Meteo",
    geo: { lat: 48.86, lon: 2.35, label: "Paris" },
  });
  compareExamplePoi([eiffel], [live(1)], {
    collectedAt: "2026-08-30T01:00:00.000Z",
    datasetSha: null,
    liveRefresh: "sample",
  });
  const second = compareExamplePoi([eiffel], [live(1), live(2), live(3)], {
    collectedAt: "2026-08-30T02:00:00.000Z",
    datasetSha: null,
    liveRefresh: "hub",
  });
  const row = second.industries[0];
  assert.equal(second.liveRefresh, "hub");
  assert.ok(row);
  assert.deepEqual(row.window, [1, 3]);
  assert.equal(row.outlook, "rising");
});

test("haversine is symmetric and zero on the same point", () => {
  const a = { lat: 40.71, lon: -74.01 };
  assert.equal(haversineKm(a, a), 0);
  assert.ok(Math.abs(haversineKm(a, { lat: 48.86, lon: 2.35 }) - haversineKm({ lat: 48.86, lon: 2.35 }, a)) < 0.01);
});

test("Place=Tokyo keeps Kyoto bright and dims Paris", () => {
  assert.equal(nearPlaceFilter(34.9948, 135.785, "tokyo"), true); // Kiyomizu-dera
  assert.equal(nearPlaceFilter(48.85826, 2.294501, "tokyo"), false);
});

test("buildTrendPins floats Place-near example POI into the pin cap", () => {
  const kyoto = {
    id: "Q647285",
    name: "Kiyomizu-dera",
    lat: 34.9948,
    lon: 135.785,
    country: "Japan",
    iso2: "JP",
    city: "Kyoto",
    category: "temple",
    sitelinks: 1,
    pagerank: 0.01,
    url: "https://audiala.com/en/japan/kyoto/kiyomizu-dera",
  };
  const farHeavy = Array.from({ length: 40 }, (_, i) =>
    placeToPost(
      {
        ...eiffel,
        id: `Q-far-${i}`,
        name: `Far ${i}`,
        lat: 48.85 + i * 0.01,
        lon: 2.29,
        pagerank: 10,
        sitelinks: 200,
      },
      "2026-08-30T00:00:00.000Z",
    ),
  );
  const pins = buildTrendPins([], "tokyo", [], [...farHeavy, placeToPost(kyoto, "2026-08-30T00:00:00.000Z")]);
  const examples = pins.filter((p) => p.kind === "example");
  assert.ok(examples.some((p) => p.label === "Kiyomizu-dera"));
  assert.equal(examples[0]?.label, "Kiyomizu-dera");
});
