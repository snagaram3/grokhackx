import assert from "node:assert/strict";
import { test } from "node:test";
import { mapDiseaseSh, mapFbiWanted, mapNasaEonet, mapNwsAlerts } from "./public-apis";

test("mapNasaEonet keeps titled events, prefers source url, falls back to eonet.gsfc, swaps GeoJSON lon/lat, caps 8 after filter", () => {
  const posts = mapNasaEonet({
    events: [
      {
        title: "Wildfire near Camry, CA",
        sources: [{ url: "https://eonet.gsfc.nasa.gov/event/camry-fire" }],
        link: "https://eonet.gsfc.nasa.gov/ghost",
        geometry: [{ date: "2026-08-26T12:00:00Z", coordinates: [-122.4, 37.8] }],
      },
      { sources: [{ url: "https://eonet.gsfc.nasa.gov/event/untitled" }] },
      {
        title: "No href wildfire",
        geometry: [{ date: "2026-08-26T13:00:00Z", coordinates: [139.7, 35.6] }],
      },
      ...Array.from({ length: 8 }, (_, i) => ({
        title: `Extra fire ${i}`,
        link: `https://eonet.gsfc.nasa.gov/event/extra-${i}`,
      })),
    ],
  });
  assert.equal(posts.length, 8);
  assert.equal(posts[0].sourceApi, "NASA EONET");
  assert.equal(posts[0].tool, "collect_public_apis");
  assert.equal(posts[0].score, 65);
  assert.equal(posts[0].url, "https://eonet.gsfc.nasa.gov/event/camry-fire");
  assert.equal(posts[0].createdAt, "2026-08-26T12:00:00Z");
  assert.deepEqual(posts[0].geo, { lat: 37.8, lon: -122.4, label: "Wildfire near Camry, CA" });
  assert.equal(posts[1].title, "No href wildfire");
  assert.equal(posts[1].url, "https://eonet.gsfc.nasa.gov/");
  assert.equal(
    posts.some((p) => p.url.includes("untitled") || p.url.includes("ghost")),
    false,
  );
  assert.deepEqual(mapNasaEonet({}), []);
  assert.deepEqual(mapNasaEonet({ events: {} }), []);
});

test("mapNwsAlerts scores Extreme/Severe, rewrites urn:oid, prefers @id, falls back to weather.gov", () => {
  const posts = mapNwsAlerts({
    features: [
      {
        properties: {
          headline: "Extreme Heat Warning Camry",
          severity: "Extreme",
          "@id": "https://api.weather.gov/alerts/urn:oid:wins",
          id: "urn:oid:2.49.0.1.840.should-lose",
          sent: "2026-08-26T12:00:00Z",
        },
        geometry: { coordinates: [-118.2, 34.0] },
      },
      {
        properties: {
          headline: "Severe Thunderstorm Watch",
          severity: "Severe",
          id: "urn:oid:2.49.0.1.840.camry",
          sent: "2026-08-26T13:00:00Z",
        },
      },
      {
        properties: {
          headline: "Moderate Advisory notice",
          severity: "Moderate",
        },
      },
      { properties: { severity: "Extreme", id: "urn:oid:ghost" } },
    ],
  });
  assert.equal(posts.length, 3);
  assert.equal(posts[0].sourceApi, "NWS");
  assert.equal(posts[0].score, 95);
  assert.equal(posts[0].url, "https://api.weather.gov/alerts/urn:oid:wins");
  assert.deepEqual(posts[0].geo, { lat: 34.0, lon: -118.2, label: "Extreme Heat Warning Camry" });
  assert.equal(posts[1].score, 80);
  assert.equal(posts[1].url, "https://api.weather.gov/alerts/2.49.0.1.840.camry");
  assert.equal(posts[2].score, 55);
  assert.equal(posts[2].url, "https://www.weather.gov/");
  assert.equal(
    posts.some((p) => p.url.includes("ghost")),
    false,
  );
  assert.deepEqual(mapNwsAlerts({}), []);
  assert.deepEqual(mapNwsAlerts({ features: {} }), []);
});

test("mapFbiWanted prefixes the title, falls back to fbi.gov/wanted, drops untitled, caps 8 after filter", () => {
  const posts = mapFbiWanted({
    items: [
      {
        title: "Camry VIN theft ring",
        url: "https://www.fbi.gov/wanted/camry",
        publication: "2026-08-01",
      },
      { title: "Nameless flyer" },
      { title: "", url: "https://www.fbi.gov/wanted/ghost" },
      { foo: 1 },
      ...Array.from({ length: 8 }, (_, i) => ({
        title: `extra ${i}`,
        url: `https://www.fbi.gov/wanted/extra-${i}`,
      })),
    ],
  });
  assert.equal(posts.length, 8);
  assert.equal(posts[0].title, "FBI Wanted: Camry VIN theft ring");
  assert.equal(posts[0].url, "https://www.fbi.gov/wanted/camry");
  assert.equal(posts[0].sourceApi, "FBI");
  assert.equal(posts[0].score, 50);
  assert.equal(posts[0].createdAt, "2026-08-01");
  assert.equal(posts[1].title, "FBI Wanted: Nameless flyer");
  assert.equal(posts[1].url, "https://www.fbi.gov/wanted");
  assert.equal(
    posts.some((p) => p.url.includes("ghost")),
    false,
  );
  assert.deepEqual(mapFbiWanted({}), []);
  assert.deepEqual(mapFbiWanted({ items: {} }), []);
});

test("mapDiseaseSh slices raw rows to 8 before dropping empties and never invents a country URL", () => {
  const posts = mapDiseaseSh([
    { country: "Japan", todayCases: 99 },
    { country: "United States", todayCases: 0 },
    { todayCases: 9999 },
    { country: "", todayCases: 50 },
  ]);
  assert.equal(posts.length, 2);
  assert.equal(posts[0].title, "Japan: 99 new COVID cases");
  assert.equal(posts[0].url, "https://disease.sh/");
  assert.equal(posts[0].sourceApi, "Disease.sh");
  assert.equal(posts[0].score, 40);
  assert.equal(posts[1].title, "United States: 0 new COVID cases");
  assert.equal(posts[1].score, 1);

  const capped = mapDiseaseSh([
    ...Array.from({ length: 8 }, () => ({})),
    { country: "Brazil", todayCases: 999 },
  ]);
  assert.deepEqual(capped, []);
  assert.deepEqual(mapDiseaseSh({}), []);
  assert.deepEqual(mapDiseaseSh(null), []);
});
