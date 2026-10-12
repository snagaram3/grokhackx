import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mapCarbonIntensity,
  mapSpacexLaunchLibrary,
  mapSpacexUpcoming,
} from "./public-apis";

test("mapSpacexUpcoming prefixes SpaceX:, falls back to launches/ when webcast misses, and slices raw rows to 8 before dropping empties", () => {
  const posts = mapSpacexUpcoming([
    {
      name: "Starlink Group 6-1",
      date_utc: "2026-10-12T00:00:00.000Z",
      links: { webcast: "https://youtu.be/starlink" },
    },
    { name: "No Webcast", date_utc: "2026-11-01T00:00:00.000Z", links: {} },
    { links: { webcast: "https://youtu.be/ghost" } },
    ...Array.from({ length: 8 }, () => ({ links: {} })),
    { name: "Camry Rideshare" },
  ]);
  assert.equal(posts.length, 2);
  assert.equal(posts[0].sourceApi, "SpaceX");
  assert.equal(posts[0].tool, "collect_public_apis");
  assert.equal(posts[0].title, "SpaceX: Starlink Group 6-1");
  assert.equal(posts[0].url, "https://youtu.be/starlink");
  assert.equal(posts[0].score, 62);
  assert.equal(posts[0].createdAt, "2026-10-12T00:00:00.000Z");
  assert.equal(posts[1].title, "SpaceX: No Webcast");
  assert.equal(posts[1].url, "https://www.spacex.com/launches/");
  assert.equal(
    posts.some((p) => p.title.includes("Camry") || p.url.includes("ghost")),
    false,
  );
  assert.deepEqual(mapSpacexUpcoming([]), []);
  assert.deepEqual(mapSpacexUpcoming({}), []);
  assert.deepEqual(mapSpacexUpcoming(null), []);
});

test("mapSpacexLaunchLibrary uses the launch URL, falls back to launches/, and caps 8 after filter", () => {
  const posts = mapSpacexLaunchLibrary({
    results: [
      ...Array.from({ length: 8 }, () => ({ url: "https://ll.example/empty" })),
      {
        name: "Falcon 9 Block 5 | Starlink",
        url: "https://ll.thespacedevs.com/launch/starlink",
        net: "2026-10-20T12:00:00Z",
      },
      { name: "No Url Flight" },
    ],
  });
  assert.equal(posts.length, 2);
  assert.equal(posts[0].title, "SpaceX: Falcon 9 Block 5 | Starlink");
  assert.equal(posts[0].url, "https://ll.thespacedevs.com/launch/starlink");
  assert.equal(posts[0].createdAt, "2026-10-20T12:00:00Z");
  assert.equal(posts[0].sourceApi, "SpaceX");
  assert.equal(posts[1].title, "SpaceX: No Url Flight");
  assert.equal(posts[1].url, "https://www.spacex.com/launches/");
  assert.deepEqual(mapSpacexLaunchLibrary({ results: [{}] }), []);
  assert.deepEqual(mapSpacexLaunchLibrary({}), []);
  assert.deepEqual(mapSpacexLaunchLibrary(null), []);
});

test("mapCarbonIntensity scores high/very high at 75, uses forecast when actual is 0, and needs an intensity object", () => {
  const high = mapCarbonIntensity({
    data: [
      {
        from: "2026-10-12T10:00:00Z",
        intensity: { index: "high", actual: 280, forecast: 200 },
      },
    ],
  });
  assert.equal(high.length, 1);
  assert.equal(high[0].title, "UK grid high (280 gCO₂/kWh)");
  assert.equal(high[0].url, "https://carbonintensity.org.uk/");
  assert.equal(high[0].score, 75);
  assert.equal(high[0].sourceApi, "Carbon Intensity");
  assert.equal(high[0].createdAt, "2026-10-12T10:00:00Z");

  const veryHigh = mapCarbonIntensity({
    data: [{ intensity: { index: "very high", actual: 400 } }],
  });
  assert.equal(veryHigh[0].score, 75);

  const actualZero = mapCarbonIntensity({
    data: [{ intensity: { index: "moderate", actual: 0, forecast: 180 } }],
  });
  assert.equal(actualZero[0].title, "UK grid moderate (180 gCO₂/kWh)");
  assert.equal(actualZero[0].score, 40);

  const capitalized = mapCarbonIntensity({
    data: [{ intensity: { index: "High", actual: 280 } }],
  });
  assert.equal(capitalized[0].score, 40);

  assert.deepEqual(mapCarbonIntensity({ data: [{}] }), []);
  assert.deepEqual(mapCarbonIntensity({}), []);
  assert.deepEqual(mapCarbonIntensity(null), []);
});
