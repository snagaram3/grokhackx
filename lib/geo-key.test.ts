import assert from "node:assert/strict";
import { test } from "node:test";
import { trendsCacheKey } from "./geo";

test("trendsCacheKey isolates Place, World, and a plugged topic", () => {
  const world = trendsCacheKey("all");
  const tokyo = trendsCacheKey("tokyo");
  const camry = trendsCacheKey("tokyo", "Camry");
  assert.notEqual(world, tokyo);
  assert.notEqual(tokyo, camry);
  assert.match(world, /:all$/);
  assert.match(tokyo, /:tokyo$/);
  assert.match(camry, /:topic:camry$/);
});

test("trendsCacheKey folds aliases and topic whitespace so the same tape is reused", () => {
  assert.equal(trendsCacheKey("world"), trendsCacheKey("all"));
  assert.equal(trendsCacheKey("sao paulo"), trendsCacheKey("saopaulo"));
  assert.equal(trendsCacheKey("tokyo", "  Camry  "), trendsCacheKey("tokyo", "camry"));
  assert.equal(trendsCacheKey("tokyo", "Camry hybrid"), trendsCacheKey("tokyo", "camry  hybrid"));
  assert.notEqual(trendsCacheKey("tokyo", "camry"), trendsCacheKey("tokyo", "camryn"));
});
