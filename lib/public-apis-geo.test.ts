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

test("geoPoint keeps pins on the poles and date line", () => {
  const north = geoPoint(90, 0, "North Pole");
  assert.equal(north?.lat, 90);
  assert.equal(north?.lon, 0);
  assert.equal(north?.label, "North Pole");

  const south = geoPoint(-90, 45, "South Pole");
  assert.equal(south?.lat, -90);
  assert.equal(south?.lon, 45);

  const east = geoPoint(-21.2, 180, "Tonga");
  assert.equal(east?.lat, -21.2);
  assert.equal(east?.lon, 180);

  const west = geoPoint(64.5, -180, "Chukotka");
  assert.equal(west?.lat, 64.5);
  assert.equal(west?.lon, -180);

  const corner = geoPoint(90, 180, "Pole on the date line");
  assert.equal(corner?.lat, 90);
  assert.equal(corner?.lon, 180);
});

test("geoFromCoords keeps GeoJSON date-line and pole Positions", () => {
  const tonga = geoFromCoords([180, -21.2], "Tonga");
  assert.equal(tonga?.lat, -21.2);
  assert.equal(tonga?.lon, 180);

  const west = geoFromCoords([-180, 64.5], "Chukotka");
  assert.equal(west?.lat, 64.5);
  assert.equal(west?.lon, -180);

  const pole = geoFromCoords([-45, 90], "North Pole");
  assert.equal(pole?.lat, 90);
  assert.equal(pole?.lon, -45);
});

test("geoPoint trims and caps the place label at 80 chars", () => {
  const long = "A".repeat(120);
  const geo = geoPoint(35.68, 139.69, `  ${long}  `);
  assert.equal(geo?.label.length, 80);
  assert.equal(geo?.lat, 35.68);
});
