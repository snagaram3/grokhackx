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

test("geoFromCoords ignores USGS depth on a 3-element Position", () => {
  // USGS Point coordinates are [longitude, latitude, depth_km].
  // Treating lon as lat would reject this Bay Area pin (lon is outside ±90).
  const bay = geoFromCoords([-122.3965, 37.7553, 8.12], "M 4.2 - San Francisco Bay");
  assert.equal(bay?.lat, 37.7553);
  assert.equal(bay?.lon, -122.3965);
  assert.equal(bay?.label, "M 4.2 - San Francisco Bay");
});

test("geoFromCoords does not pin depth as latitude when depth is a legal lat", () => {
  // 8.4 km is a legal latitude. Using coordinates[2] as lat would silently
  // move this Mediterranean pin to the Gulf of Guinea.
  const rome = geoFromCoords([12.5, 41.9, 8.4], "Rome");
  assert.equal(rome?.lat, 41.9);
  assert.equal(rome?.lon, 12.5);
  const extra = geoFromCoords([12.5, 41.9, 8.4, 99], "Rome");
  assert.equal(extra?.lat, 41.9);
  assert.equal(extra?.lon, 12.5);
});

test("geoFromCoords unwraps nested rings that carry altitude", () => {
  const nws = geoFromCoords(
    [
      [
        [-45.5, -23.1, 0],
        [-45.6, -23.2, 0],
      ],
    ],
    "South Atlantic",
  );
  assert.equal(nws?.lat, -23.1);
  assert.equal(nws?.lon, -45.5);
});
