import assert from "node:assert/strict";
import { test } from "node:test";
import { geoFromCoords, geoPoint } from "./public-apis";

test("geoFromCoords reads GeoJSON [lon, lat] and does not swap them", () => {
  const tokyo = geoFromCoords([139.69, 35.68], "Tokyo");
  assert.equal(tokyo?.lat, 35.68);
  assert.equal(tokyo?.lon, 139.69);
  assert.equal(tokyo?.label, "Tokyo");
});

test("geoFromCoords unwraps nested USGS / EONET rings", () => {
  const quake = geoFromCoords([[[179.2, -23.1]]], "Fiji");
  assert.equal(quake?.lat, -23.1);
  assert.equal(quake?.lon, 179.2);
});

test("geoFromCoords and geoPoint reject junk instead of inventing a pin", () => {
  assert.equal(geoFromCoords([200, 35], "Pacific"), undefined);
  assert.equal(geoFromCoords([139.69], "Tokyo"), undefined);
  assert.equal(geoFromCoords("35,139", "Tokyo"), undefined);
  assert.equal(geoPoint(91, 0, "pole"), undefined);
  assert.equal(geoPoint(0, 181, "date line"), undefined);
  assert.equal(geoPoint(Number.NaN, 139, "Tokyo"), undefined);
  assert.equal(geoPoint(35.68, 139.69, "   "), undefined);
});

test("geoPoint trims and caps the place label at 80 chars", () => {
  const long = "A".repeat(120);
  const geo = geoPoint(35.68, 139.69, `  ${long}  `);
  assert.equal(geo?.label.length, 80);
  assert.equal(geo?.lat, 35.68);
});
