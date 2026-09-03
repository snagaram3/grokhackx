import assert from "node:assert/strict";
import { test } from "node:test";
import {
  API_SOURCE_CATEGORIES,
  applyToggleCategory,
  applyToggleSource,
  filterByEnabledSources,
  getAllApiSources,
  loadApiSourceSelection,
  parseApiSourceSelection,
  parseEnabledSources,
  type ApiSourceSelection,
} from "./api-source-selection";
import { publicApiFeedNames } from "./public-apis";

function selection(enabled: string[]): ApiSourceSelection {
  return { enabled, updatedAt: "2026-08-29T00:00:00.000Z" };
}

test("catalog names are unique and match live public-API feed names", () => {
  const catalog = getAllApiSources();
  assert.ok(catalog.length > 20);
  assert.equal(new Set(catalog).size, catalog.length);
  assert.equal(new Set(API_SOURCE_CATEGORIES.map((c) => c.name)).size, API_SOURCE_CATEGORIES.length);

  const feeds = publicApiFeedNames();
  assert.equal(new Set(feeds).size, feeds.length);
  for (const name of catalog) {
    assert.ok(feeds.includes(name), `toggle catalog lists ${name} but no feed uses that name`);
  }
  for (const name of feeds) {
    assert.ok(catalog.includes(name), `feed ${name} cannot be toggled off`);
  }
});

test("parseApiSourceSelection falls back when JSON is missing, corrupt, or unshaped", () => {
  const all = getAllApiSources();
  assert.deepEqual(parseApiSourceSelection(null).enabled, all);
  assert.deepEqual(parseApiSourceSelection("not-json").enabled, all);
  assert.deepEqual(parseApiSourceSelection(JSON.stringify({ foo: 1 })).enabled, all);
  assert.deepEqual(parseApiSourceSelection(JSON.stringify({ enabled: "GDELT" })).enabled, all);
  assert.deepEqual(parseApiSourceSelection(JSON.stringify({ enabled: ["GDELT", "GitHub"] })).enabled, [
    "GDELT",
    "GitHub",
  ]);
});

test("Node loadApiSourceSelection defaults to every catalog source", () => {
  assert.equal(typeof window, "undefined");
  assert.deepEqual(loadApiSourceSelection().enabled, getAllApiSources());
});

test("parseEnabledSources prefers the query param and only accepts a JSON array cookie", () => {
  assert.equal(parseEnabledSources(null, null), undefined);
  assert.deepEqual(parseEnabledSources("GDELT, GitHub, ", '["Wikipedia"]'), ["GDELT", "GitHub"]);
  assert.deepEqual(parseEnabledSources(null, '["GDELT","GitHub"]'), ["GDELT", "GitHub"]);
  assert.deepEqual(parseEnabledSources(null, '["GDELT",1,null]'), ["GDELT"]);
  assert.equal(parseEnabledSources(null, "not-json"), undefined);
  assert.equal(parseEnabledSources(null, JSON.stringify({ enabled: ["GDELT"] })), undefined);
  assert.deepEqual(parseEnabledSources(null, "[]"), []);
});

test("filterByEnabledSources treats undefined as all and [] as none", () => {
  const feeds = [{ name: "GDELT" }, { name: "GitHub" }, { name: "Wikipedia" }];
  assert.deepEqual(filterByEnabledSources(feeds, undefined), feeds);
  assert.deepEqual(filterByEnabledSources(feeds, []), []);
  assert.deepEqual(
    filterByEnabledSources(feeds, ["GitHub"]).map((f) => f.name),
    ["GitHub"],
  );
  assert.deepEqual(filterByEnabledSources(feeds, ["Not A Feed"]), []);
});

test("applyToggleSource adds and removes without dropping other names", () => {
  const start = selection(["GDELT", "GitHub"]);
  const off = applyToggleSource(start, "GitHub");
  assert.deepEqual(off.enabled, ["GDELT"]);
  const on = applyToggleSource(off, "Wikipedia");
  assert.deepEqual(on.enabled.toSorted(), ["GDELT", "Wikipedia"]);
});

test("applyToggleCategory enable is idempotent; disable keeps other categories", () => {
  const sports = API_SOURCE_CATEGORIES.find((c) => c.name === "Sports");
  assert.ok(sports);
  const start = selection(["GDELT", "ESPN"]);
  const enabled = applyToggleCategory(start, "Sports", true);
  assert.ok(sports!.sources.every((s) => enabled.enabled.includes(s)));
  assert.equal(enabled.enabled.filter((s) => s === "ESPN").length, 1);
  assert.ok(enabled.enabled.includes("GDELT"));

  const again = applyToggleCategory(enabled, "Sports", true);
  assert.equal(again.enabled.filter((s) => s === "ESPN").length, 1);

  const disabled = applyToggleCategory(enabled, "Sports", false);
  assert.deepEqual(disabled.enabled, ["GDELT"]);
  assert.deepEqual(applyToggleCategory(start, "Not A Category", true), start);
});
