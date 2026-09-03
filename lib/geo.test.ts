import assert from "node:assert/strict";
import { test } from "node:test";
import { CITIES, geoAgent, tvCountry, weatherSpots, WORLD_REDDIT, youtubeRegions } from "./geo";

test("geoAgent keeps the world tape and parks a city sub beside it", () => {
  const world = geoAgent("all");
  assert.equal(world.city, "all");
  assert.equal(world.label, null);
  assert.deepEqual(world.redditSubs, [...WORLD_REDDIT]);
  assert.equal(world.log, "geo: world");

  const london = geoAgent("London");
  assert.equal(london.city, "london");
  assert.equal(london.label, "London");
  assert.ok(london.redditSubs.includes("london"));
  assert.ok(WORLD_REDDIT.every((sub) => london.redditSubs.includes(sub)));
  assert.equal(london.log, "geo: london r/london+world");
});

test("weather, YouTube, and TV routing stay city-scoped without geocoding", () => {
  const worldWeather = weatherSpots("all");
  assert.equal(worldWeather.length, Object.keys(CITIES).length);
  assert.ok(worldWeather.some((s) => s.label === "London" && s.lat === 51.51));

  const nyc = weatherSpots("nyc");
  assert.equal(nyc.length, 1);
  assert.equal(nyc[0].label, "NYC");
  assert.equal(nyc[0].lon, -74.01);

  assert.deepEqual(youtubeRegions("all"), ["IN", "BR", "JP", "NG"]);
  assert.deepEqual(youtubeRegions("tokyo"), ["JP"]);
  assert.equal(tvCountry("all"), null);
  assert.equal(tvCountry("london"), "GB");
  assert.equal(tvCountry("saopaulo"), "BR");
});
