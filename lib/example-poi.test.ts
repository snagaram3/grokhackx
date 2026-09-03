import assert from "node:assert/strict";
import { test } from "node:test";
import { compareExamplePoi, haversineKm, industryOf, PAIR_KM, pairExamplePoi } from "./example-poi-compare";
import {
  EXAMPLE_POI_SOURCE,
  EXAMPLE_POI_TOOL,
  loadExamplePoiSample,
  nearPlaceFilter,
  placeFromCsvRow,
  placeToPost,
  selectExamplePoi,
  splitCsvLine,
} from "./example-poi";
import {
  hourBucket,
  industryOutlookFromHours,
  industryWindow,
  peekIndustrySeries,
  resetIndustrySeries,
} from "./example-poi-series";
import { CITIES, PLACE_NEAR_KM } from "./geo";
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

test("name regex maps hospital/bank/mall before the building category", () => {
  assert.equal(industryOf({ name: "City Hospital", category: "building" }), "healthcare");
  assert.equal(industryOf({ name: "Stock Exchange", category: "building" }), "finance");
  assert.equal(industryOf({ name: "Grand Bazaar", category: "building" }), "retail");
  assert.equal(industryOf({ name: "Mystery Place", category: "unknown-cat" }), "entertainment");
});

test("splitCsvLine unescapes doubled quotes", () => {
  assert.deepEqual(splitCsvLine('Q1,"Statue of ""Liberty""",40.6,-74'), [
    "Q1",
    'Statue of "Liberty"',
    "40.6",
    "-74",
  ]);
});

test("placeFromCsvRow reads Hub pagerank and falls back to a Wikidata URL", () => {
  const header = splitCsvLine(
    "wikidata_id,name_en,latitude,longitude,country_iso2,country_en,city_en,category,sitelinks,wikidata_pagerank,url_en",
  );
  const place = placeFromCsvRow(
    header,
    splitCsvLine("Q243,Eiffel Tower,48.85826,2.294501,FR,France,Paris,tower,189,0.91,"),
  );
  assert.equal(place?.pagerank, 0.91);
  assert.equal(place?.url, "https://www.wikidata.org/wiki/Q243");
});

test("placeToPost clamps sitelinks into score and keeps proven coords", () => {
  const quiet = placeToPost({ ...eiffel, sitelinks: 0, category: "", city: "", country: "" }, "2026-08-30T00:00:00.000Z");
  assert.equal(quiet.score, 1);
  assert.equal(quiet.title, "Example POI · Eiffel Tower");
  const loud = placeToPost({ ...eiffel, sitelinks: 250 }, "2026-08-30T00:00:00.000Z");
  assert.equal(loud.score, 100);
  assert.deepEqual(loud.geo, { lat: eiffel.lat, lon: eiffel.lon, label: eiffel.name });
});

test("selectExamplePoi floats Place-near rows first and leaves World alone", () => {
  const kyoto = {
    ...eiffel,
    id: "Q647285",
    name: "Kiyomizu-dera",
    lat: 34.9948,
    lon: 135.785,
    city: "Kyoto",
    country: "Japan",
    iso2: "JP",
    category: "temple",
  };
  const ordered = selectExamplePoi([eiffel, kyoto], "tokyo");
  assert.equal(ordered[0]?.id, "Q647285");
  assert.equal(selectExamplePoi([eiffel, kyoto], "all")[0]?.id, "Q243");
});

test("pairs the nearest example POI and skips receipts with no proven geo", () => {
  const louvre = {
    ...eiffel,
    id: "Q19675",
    name: "Louvre",
    lat: 48.8606,
    lon: 2.3376,
    category: "museum",
  };
  const onLouvre: Post = {
    platform: "public",
    title: "Paris 18°C",
    url: "https://open-meteo.com/en/docs#latitude=48.8606&longitude=2.3376",
    score: 40,
    createdAt: "2026-08-30T00:00:00.000Z",
    sourceApi: "Open-Meteo",
    geo: { lat: 48.8606, lon: 2.3376, label: "Louvre" },
  };
  const hn: Post = {
    platform: "hn",
    title: "Paris Hilton launches a wrap",
    url: "https://news.ycombinator.com/item?id=9",
    score: 12,
    createdAt: "2026-08-30T00:00:00.000Z",
  };
  const pairs = pairExamplePoi([eiffel, louvre], [onLouvre, hn]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0]?.poiName, "Louvre");
  assert.ok((pairs[0]?.km ?? 99) < (haversineKm(onLouvre.geo!, eiffel) as number));
});

test("PAIR_KM is tighter than the Place near-box — 420 km sits on the map but does not pair", () => {
  const tokyo = CITIES.tokyo;
  const tower = {
    ...eiffel,
    id: "Q10486",
    name: "Tokyo Tower",
    lat: tokyo.lat,
    lon: tokyo.lon,
    city: "Tokyo",
    country: "Japan",
    iso2: "JP",
    category: "tower",
  };
  const far = { lat: tokyo.lat + 3.78, lon: tokyo.lon };
  const km = haversineKm(tokyo, far);
  assert.ok(km > PAIR_KM, `need > ${PAIR_KM} km, got ${km}`);
  assert.ok(km <= PLACE_NEAR_KM, `need <= ${PLACE_NEAR_KM} km, got ${km}`);
  assert.equal(nearPlaceFilter(far.lat, far.lon, "tokyo"), true);
  const live: Post = {
    platform: "public",
    title: "Far station",
    url: `https://open-meteo.com/en/docs#latitude=${far.lat}&longitude=${far.lon}`,
    score: 40,
    createdAt: "2026-08-30T00:00:00.000Z",
    sourceApi: "Open-Meteo",
    geo: { lat: far.lat, lon: far.lon, label: "Far station" },
  };
  assert.equal(pairExamplePoi([tower], [live]).length, 0);
  const near: Post = {
    ...live,
    title: "Tokyo 28°C",
    url: `https://open-meteo.com/en/docs#latitude=${tokyo.lat}&longitude=${tokyo.lon}`,
    geo: { lat: tokyo.lat, lon: tokyo.lon, label: "Tokyo" },
  };
  assert.equal(pairExamplePoi([tower], [near]).length, 1);
});

test("World Place filter never dims a coordinate", () => {
  assert.equal(nearPlaceFilter(0, 0, "all"), true);
  assert.equal(nearPlaceFilter(-51.7, -57.8, "all"), true);
});

test("example pins keep a distinct id so they cannot overwrite a live receipt at the same 0.1°", () => {
  const here = { lat: 48.86, lon: 2.35 };
  assert.notEqual(examplePinId(here.lat, here.lon), receiptPinId(here.lat, here.lon));
  assert.match(examplePinId(here.lat, here.lon), /^ex:/);
  const live: Post = {
    platform: "public",
    title: "Paris 18°C",
    url: "https://open-meteo.com/en/docs#latitude=48.86&longitude=2.35",
    score: 40,
    createdAt: "2026-08-30T00:00:00.000Z",
    sourceApi: "Open-Meteo",
    geo: { lat: 48.86, lon: 2.35, label: "Paris" },
  };
  const example = placeToPost({ ...eiffel, lat: 48.86, lon: 2.35 }, "2026-08-30T00:00:00.000Z");
  const pins = buildTrendPins([], "all", [live], [example]);
  assert.equal(pins.filter((p) => p.kind === "receipt").length, 1);
  assert.equal(pins.filter((p) => p.kind === "example").length, 1);
});

test("weather tape on hospitality is a weather call; USGS wins when both sit nearby", () => {
  resetIndustrySeries();
  const park = {
    ...eiffel,
    id: "Q1665",
    name: "Jardin du Luxembourg",
    lat: 48.8462,
    lon: 2.3371,
    category: "park",
  };
  const weather: Post = {
    platform: "public",
    title: "Paris 18°C wind 3",
    url: "https://open-meteo.com/en/docs#latitude=48.85&longitude=2.34",
    score: 40,
    createdAt: "2026-08-30T00:00:00.000Z",
    sourceApi: "Open-Meteo",
    geo: { lat: 48.85, lon: 2.34, label: "Paris" },
  };
  const weatherCall = compareExamplePoi([park], [weather], {
    collectedAt: "2026-08-30T00:00:00.000Z",
    datasetSha: null,
  });
  assert.match(weatherCall.industries[0]?.prediction.headline ?? "", /Weather tape/i);

  resetIndustrySeries();
  const quake: Post = {
    platform: "public",
    title: "M 5.1 - Île-de-France",
    url: "https://earthquake.usgs.gov/earthquakes/eventpage/us2",
    score: 80,
    createdAt: "2026-08-30T00:00:00.000Z",
    sourceApi: "USGS",
    geo: { lat: 48.86, lon: 2.35, label: "Paris" },
  };
  const both = compareExamplePoi([eiffel], [weather, quake], {
    collectedAt: "2026-08-30T00:00:00.000Z",
    datasetSha: null,
  });
  assert.match(both.industries[0]?.prediction.headline ?? "", /Hazard tape/i);
  assert.equal(both.pairs.length, 2);
});

test("compare reports every pair but only keeps 12 hops on the desk", () => {
  resetIndustrySeries();
  const located: Post[] = Array.from({ length: 13 }, (_, i) => ({
    platform: "public" as const,
    title: `Paris station ${i}`,
    url: `https://open-meteo.com/en/docs#latitude=48.86&longitude=2.35&n=${i}`,
    score: 40,
    createdAt: "2026-08-30T00:00:00.000Z",
    sourceApi: "Open-Meteo",
    geo: { lat: 48.86, lon: 2.35, label: "Paris" },
  }));
  const report = compareExamplePoi([eiffel], located, {
    collectedAt: "2026-08-30T00:00:00.000Z",
    datasetSha: null,
  });
  assert.equal(report.pairCount, 13);
  assert.equal(report.pairs.length, 12);
  assert.equal(report.thin, false);
});

test("hourBucket floors to UTC and does not invent a timezone", () => {
  assert.equal(hourBucket("2026-08-30T14:37:12.999Z"), "2026-08-30T14:00:00.000Z");
  assert.equal(hourBucket("2026-08-30T00:59:59.000Z"), "2026-08-30T00:00:00.000Z");
  assert.equal(hourBucket("not-a-date"), "not-a-date:00:00.000Z");
});

test("same UTC hour overwrites; a ninth hour drops the oldest; a missing industry counts as 0", () => {
  resetIndustrySeries();
  const paris = (n: number): Post => ({
    platform: "public",
    title: `Paris ${n}°C`,
    url: `https://open-meteo.com/en/docs#latitude=48.86&longitude=2.35&n=${n}`,
    score: 40,
    createdAt: "2026-08-30T00:00:00.000Z",
    sourceApi: "Open-Meteo",
    geo: { lat: 48.86, lon: 2.35, label: "Paris" },
  });
  compareExamplePoi([eiffel], [paris(1)], {
    collectedAt: "2026-08-30T01:10:00.000Z",
    datasetSha: null,
  });
  compareExamplePoi([eiffel], [paris(1), paris(2), paris(3)], {
    collectedAt: "2026-08-30T01:50:00.000Z",
    datasetSha: null,
  });
  assert.equal(peekIndustrySeries().length, 1);
  assert.deepEqual(industryWindow("real-estate"), [3]);

  const tokyo: Post = {
    platform: "public",
    title: "Tokyo 28°C",
    url: "https://open-meteo.com/en/docs#latitude=35.68&longitude=139.69",
    score: 40,
    createdAt: "2026-08-30T00:00:00.000Z",
    sourceApi: "Open-Meteo",
    geo: { lat: 35.68, lon: 139.69, label: "Tokyo" },
  };
  compareExamplePoi([eiffel], [tokyo], {
    collectedAt: "2026-08-30T02:00:00.000Z",
    datasetSha: null,
  });
  assert.deepEqual(industryWindow("real-estate"), [3, 0]);
  assert.equal(industryOutlookFromHours("real-estate", 0).outlook, "fading");

  for (let h = 3; h <= 9; h++) {
    compareExamplePoi([eiffel], [paris(h)], {
      collectedAt: `2026-08-30T0${h}:00:00.000Z`,
      datasetSha: null,
    });
  }
  const hours = peekIndustrySeries().map((s) => s.hour);
  assert.equal(hours.length, 8);
  assert.equal(hours[0], "2026-08-30T02:00:00.000Z");
  assert.equal(hours.at(-1), "2026-08-30T09:00:00.000Z");
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
