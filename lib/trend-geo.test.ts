import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTrendPins, examplePinId, parseUrlGeo, postGeo, receiptPinId, validGeo } from "./trend-geo";
import { topoLandToMultiPolygon } from "./world-land";
import type { Topic } from "./types";

function topic(label: string, posts: Topic["platforms"]["public"]["posts"]): Topic {
  const empty = { score: 0, posts: [] as Topic["platforms"]["public"]["posts"] };
  return {
    id: label.toLowerCase().replace(/\s+/g, "-"),
    label,
    platforms: { x: empty, reddit: empty, hn: empty, public: { score: posts.length * 10, posts } },
    velocity: "rising",
    divergence: 0,
    tickers: [],
  };
}

test("parseUrlGeo reads Open-Meteo hash coords and rejects junk", () => {
  const geo = parseUrlGeo("https://open-meteo.com/en/docs#latitude=35.68&longitude=139.69", "Tokyo");
  assert.equal(geo?.lat, 35.68);
  assert.equal(geo?.lon, 139.69);
  assert.equal(parseUrlGeo("https://news.ycombinator.com/item?id=1", "HN"), null);
  assert.equal(validGeo(91, 0), false);
});

test("buildTrendPins keeps USGS coords and ignores titles without a place", () => {
  const quake = topic("Pacific quake", [
    {
      platform: "public",
      title: "M 6.2 - south of the Fiji Islands",
      url: "https://earthquake.usgs.gov/earthquakes/eventpage/us1",
      score: 80,
      createdAt: "2026-08-29T00:00:00.000Z",
      sourceApi: "USGS",
      geo: { lat: -23.1, lon: 179.2, label: "Fiji" },
    },
  ]);
  const hn = topic("Camry recall", [
    {
      platform: "hn",
      title: "Toyota plans Camry recall",
      url: "https://news.ycombinator.com/item?id=1",
      score: 40,
      createdAt: "2026-08-29T00:00:00.000Z",
    },
  ]);
  const pins = buildTrendPins([quake, hn]);
  assert.equal(pins.length, 1);
  assert.equal(pins[0]?.source, "USGS");
  assert.equal(pins[0]?.kind, "receipt");
  assert.ok(pins[0]?.topicIds.includes("pacific-quake"));
});

test("located extras pin even when clustering dropped the weather topic", () => {
  const pins = buildTrendPins([], "all", [
    {
      platform: "public",
      title: "Tokyo 28°C wind 4",
      url: "https://open-meteo.com/en/docs#latitude=35.68&longitude=139.69",
      score: 40,
      createdAt: "2026-08-29T00:00:00.000Z",
      sourceApi: "Open-Meteo",
    },
  ]);
  assert.equal(pins[0]?.label.includes("Tokyo") || pins[0]?.title.includes("Tokyo"), true);
  assert.equal(pins[0]?.topicIds.length, 0);
});

test("buildTrendPins recovers Open-Meteo coords from the URL when geo was stripped", () => {
  const weather = topic("Tokyo weather", [
    {
      platform: "public",
      title: "Tokyo 28°C wind 4",
      url: "https://open-meteo.com/en/docs#latitude=35.68&longitude=139.69",
      score: 40,
      createdAt: "2026-08-29T00:00:00.000Z",
      sourceApi: "Open-Meteo",
    },
  ]);
  const pins = buildTrendPins([weather]);
  assert.equal(pins.length, 1);
  assert.equal(pins[0]?.lat, 35.68);
  assert.equal(postGeo(weather.platforms.public.posts[0]!)?.lon, 139.69);
});

test("Paris Hilton in a title does not invent a Paris pin", () => {
  const gossip = topic("Hilton", [
    {
      platform: "hn",
      title: "Paris Hilton launches a Camry wrap",
      url: "https://news.ycombinator.com/item?id=2",
      score: 12,
      createdAt: "2026-08-29T00:00:00.000Z",
    },
  ]);
  assert.equal(buildTrendPins([gossip]).length, 0);
});

test("Place filter adds a lens pin that is not counted as a receipt", () => {
  const pins = buildTrendPins([], "tokyo");
  assert.equal(pins.length, 1);
  assert.equal(pins[0]?.kind, "lens");
  assert.equal(pins[0]?.label, "Tokyo");
});

test("stored geo wins over a conflicting URL, but invalid stored geo falls back to the URL", () => {
  const stored = {
    platform: "public" as const,
    title: "Tokyo 28°C",
    url: "https://open-meteo.com/en/docs#latitude=48.86&longitude=2.35",
    score: 40,
    createdAt: "2026-08-29T00:00:00.000Z",
    sourceApi: "Open-Meteo",
    geo: { lat: 35.68, lon: 139.69, label: "Tokyo" },
  };
  assert.equal(postGeo(stored)?.lat, 35.68);
  assert.equal(postGeo(stored)?.lon, 139.69);

  const junk = {
    ...stored,
    geo: { lat: 99, lon: 0, label: "Nowhere" },
  };
  assert.equal(postGeo(junk)?.lat, 48.86);
  assert.equal(postGeo(junk)?.label, "Nowhere");
});

test("example and receipt pin ids stay distinct at the same 0.1° cell", () => {
  assert.equal(receiptPinId(35.68, 139.69), "35.7,139.7");
  assert.equal(examplePinId(35.68, 139.69), "ex:35.7,139.7");
});

test("topoLandToMultiPolygon stitches a one-arc square", () => {
  const land = topoLandToMultiPolygon({
    type: "Topology",
    transform: { scale: [1, 1], translate: [0, 0] },
    arcs: [
      [
        [0, 0],
        [2, 0],
        [0, 2],
        [-2, 0],
        [0, -2],
      ],
    ],
    objects: { land: { type: "MultiPolygon", arcs: [[[0]]] } },
  });
  assert.equal(land?.type, "MultiPolygon");
  assert.ok((land?.coordinates[0]?.[0]?.length ?? 0) >= 4);
});

test("topoLandToMultiPolygon reads GeometryCollection land (world-atlas)", () => {
  const land = topoLandToMultiPolygon({
    type: "Topology",
    transform: { scale: [1, 1], translate: [0, 0] },
    arcs: [
      [
        [0, 0],
        [2, 0],
        [0, 2],
        [-2, 0],
        [0, -2],
      ],
    ],
    objects: {
      land: {
        type: "GeometryCollection",
        geometries: [{ type: "MultiPolygon", arcs: [[[0]]] }],
      },
    },
  });
  assert.equal(land?.type, "MultiPolygon");
  assert.ok((land?.coordinates[0]?.[0]?.length ?? 0) >= 4);
});
