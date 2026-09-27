import assert from "node:assert/strict";
import { test } from "node:test";
import { CITIES, geoAgent, parseCity, tvCountry, weatherSpots, WORLD_REDDIT, youtubeRegions } from "./geo";

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

test("parseCity leftover aliases keep unaccented and empty needles on the city id or World", () => {
  assert.equal(parseCity("sao paulo"), "saopaulo");
  assert.equal(parseCity("san francisco"), "sf");
  assert.equal(parseCity("mexicocity"), "mexicocity");
  assert.equal(parseCity("sf"), "sf");
  assert.equal(parseCity("TOKYO"), "tokyo");
  assert.equal(parseCity(""), "all");
  assert.equal(parseCity("  "), "all");
});

test("geoAgent leftover cities park their city sub beside the world tape", () => {
  const leftover: Array<[string, string, string]> = [
    ["tokyo", "Tokyo", "tokyo"],
    ["sydney", "Sydney", "sydney"],
    ["cairo", "Cairo", "egypt"],
    ["berlin", "Berlin", "berlin"],
    ["seoul", "Seoul", "korea"],
    ["nairobi", "Nairobi", "Kenya"],
    ["jakarta", "Jakarta", "indonesia"],
    ["toronto", "Toronto", "toronto"],
  ];
  for (const [id, label, sub] of leftover) {
    const geo = geoAgent(id);
    assert.equal(geo.city, id);
    assert.equal(geo.label, label);
    assert.ok(geo.redditSubs.includes(sub));
    assert.ok(WORLD_REDDIT.every((s) => geo.redditSubs.includes(s)));
    assert.equal(geo.log, `geo: ${id} r/${sub}+world`);
  }
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

  const leftoverCodes: Array<[Exclude<keyof typeof CITIES, never>, string]> = [
    ["sydney", "AU"],
    ["cairo", "EG"],
    ["berlin", "DE"],
    ["seoul", "KR"],
    ["nairobi", "KE"],
    ["jakarta", "ID"],
    ["toronto", "CA"],
    ["nyc", "US"],
    ["sf", "US"],
    ["mexicocity", "MX"],
  ];
  for (const [id, code] of leftoverCodes) {
    assert.deepEqual(youtubeRegions(id), [code]);
    assert.equal(tvCountry(id), code);
  }
});
