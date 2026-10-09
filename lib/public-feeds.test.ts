import assert from "node:assert/strict";
import { test } from "node:test";
import { mapCisaKev, mapFederalRegister, mapUsgsQuakes } from "./public-apis";

test("mapUsgsQuakes keeps titled quakes, falls back to usgs.gov, swaps GeoJSON lon/lat, caps 8", () => {
  const posts = mapUsgsQuakes({
    features: [
      {
        properties: {
          title: "M 7.0 - near Camry, CA",
          url: "https://earthquake.usgs.gov/earthquakes/eventpage/ci1",
          mag: 7,
          time: Date.UTC(2026, 7, 26, 12, 0, 0),
        },
        geometry: { coordinates: [-122.4, 37.8, 10] },
      },
      { properties: { mag: 6.2, url: "https://earthquake.usgs.gov/earthquakes/eventpage/ghost" } },
      {
        properties: { title: "M 4.1 - no href", mag: 4.1 },
        geometry: { coordinates: [139.7, 35.6] },
      },
      ...Array.from({ length: 8 }, (_, i) => ({
        properties: { title: `M 3.${i} extra`, mag: 3, url: `https://earthquake.usgs.gov/eq/${i}` },
      })),
    ],
  });
  assert.equal(posts.length, 8);
  assert.equal(posts[0].sourceApi, "USGS");
  assert.equal(posts[0].tool, "collect_public_apis");
  assert.equal(posts[0].score, 84);
  assert.equal(posts[0].createdAt, "2026-08-26T12:00:00.000Z");
  assert.deepEqual(posts[0].geo, { lat: 37.8, lon: -122.4, label: "M 7.0 - near Camry, CA" });
  assert.equal(posts[1].title, "M 4.1 - no href");
  assert.equal(posts[1].url, "https://earthquake.usgs.gov/");
  assert.equal(
    posts.some((p) => p.url.includes("ghost")),
    false,
  );
  assert.deepEqual(mapUsgsQuakes({}), []);
  assert.deepEqual(mapUsgsQuakes({ features: {} }), []);
  const magZero = mapUsgsQuakes({
    features: [{ properties: { title: "M 0.0 micro", mag: 0, url: "https://earthquake.usgs.gov/micro" } }],
  });
  assert.equal(magZero[0].score, 1);
});

test("mapCisaKev prefers NVD CVE URLs, falls back to the KEV catalog, and caps raw rows at 8", () => {
  const posts = mapCisaKev({
    vulnerabilities: [
      { cveID: "CVE-2024-1234", vulnerabilityName: "Camry infotainment RCE", dateAdded: "2024-06-01" },
      { vulnerabilityName: "Nameless CVE" },
      { cveID: "", vulnerabilityName: "" },
      { foo: 1 },
    ],
  });
  assert.equal(posts.length, 2);
  assert.equal(posts[0].title, "CVE-2024-1234 Camry infotainment RCE");
  assert.equal(posts[0].url, "https://nvd.nist.gov/vuln/detail/CVE-2024-1234");
  assert.equal(posts[0].sourceApi, "CISA");
  assert.equal(posts[0].createdAt, "2024-06-01");
  assert.equal(posts[1].title, "Nameless CVE");
  assert.equal(posts[1].url, "https://www.cisa.gov/known-exploited-vulnerabilities-catalog");

  const capped = mapCisaKev({
    vulnerabilities: [
      ...Array.from({ length: 8 }, () => ({})),
      { cveID: "CVE-2024-9999", vulnerabilityName: "should drop" },
    ],
  });
  assert.deepEqual(capped, []);
  assert.deepEqual(mapCisaKev({}), []);
  assert.deepEqual(mapCisaKev({ vulnerabilities: {} }), []);
});

test("mapFederalRegister requires title and html_url and does not invent a register URL", () => {
  const posts = mapFederalRegister({
    results: [
      {
        title: "Camry fuel economy standards",
        html_url: "https://www.federalregister.gov/documents/2026/01/01/camry",
        publication_date: "2026-01-01",
      },
      { title: "Untitled docket" },
      { html_url: "https://www.federalregister.gov/documents/ghost" },
      { title: "", html_url: "https://www.federalregister.gov/documents/empty" },
    ],
  });
  assert.equal(posts.length, 1);
  assert.equal(posts[0].title, "Camry fuel economy standards");
  assert.equal(posts[0].url, "https://www.federalregister.gov/documents/2026/01/01/camry");
  assert.equal(posts[0].sourceApi, "Federal Register");
  assert.equal(posts[0].score, 58);
  assert.equal(posts[0].createdAt, "2026-01-01");
  assert.deepEqual(mapFederalRegister({}), []);
  assert.deepEqual(mapFederalRegister({ results: {} }), []);
});
