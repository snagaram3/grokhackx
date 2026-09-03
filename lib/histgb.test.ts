import assert from "node:assert/strict";
import { test } from "node:test";
import {
  asOutlookClass,
  examplesFromCounts,
  fitHistGb,
  MIN_HISTGB_SAMPLES,
  MIN_OCCUPANCY_LABELS,
  occupancyVector,
  parseHistGbModel,
  predictHistGb,
  predictOutlook,
  windowVector,
} from "./histgb";

test("examplesFromCounts skips the latest pair so the last window is held out", () => {
  const counts = [2, 4, 8, 16, 32];
  const examples = examplesFromCounts(counts, counts.map((n) => n / 100), 0.4, 0.6);
  assert.equal(examples.length, 2);
  assert.ok(examples.every((e) => e.x.length === 8));
  assert.deepEqual(
    examples.map((e) => e.y),
    [2, 2],
  );
  assert.equal(examplesFromCounts([2, 4, 8], [0, 0, 0], 0, 0).length, 0);
});

test("asOutlookClass maps stable to peaking and drops thin", () => {
  assert.equal(asOutlookClass("rising"), "rising");
  assert.equal(asOutlookClass("peaking"), "peaking");
  assert.equal(asOutlookClass("fading"), "fading");
  assert.equal(asOutlookClass("stable"), "peaking");
  assert.equal(asOutlookClass("thin"), null);
});

test("examplesFromCounts labels the 8% move with a strict greater-than", () => {
  assert.equal(examplesFromCounts([100, 100, 108, 200], [0, 0, 0, 0], 0, 0)[0]?.y, 1);
  assert.equal(examplesFromCounts([100, 100, 109, 200], [0, 0, 0, 0], 0, 0)[0]?.y, 2);
  assert.equal(examplesFromCounts([100, 100, 92, 1], [0, 0, 0, 0], 0, 0)[0]?.y, 1);
  assert.equal(examplesFromCounts([100, 100, 91, 1], [0, 0, 0, 0], 0, 0)[0]?.y, 0);
});

test("windowVector pads a short slice and keeps only the last four counts", () => {
  assert.deepEqual(windowVector([5], 0.1, 0.2, 0.3, 0.4), [5, 0, 0, 0.1, 0.2, 0.3, 0.4, 1]);
  assert.deepEqual(windowVector([1, 2, 3, 4, 5], 0.2, 0.1, 0, 1), [5, 4, 3, 0.2, 0.1, 0, 1, 4]);
});

test("occupancyVector clamps title length and floors occupancy labels at 20", () => {
  assert.equal(MIN_OCCUPANCY_LABELS, 20);
  assert.deepEqual(
    occupancyVector({ officialHost: true, hasQr: false, titleLen: 60, hostHasBrand: true }),
    [1, 0, 0.5, 1],
  );
  assert.deepEqual(
    occupancyVector({ officialHost: false, hasQr: true, titleLen: 240, hostHasBrand: false }),
    [0, 1, 1, 0],
  );
});

test("fitHistGb abstains under MIN_HISTGB_SAMPLES", () => {
  const tiny = Array.from({ length: MIN_HISTGB_SAMPLES - 1 }, (_, i) => ({
    x: windowVector([i, i + 1, i + 2, i + 3], 0.1, 0.1, 0.2, 0.8),
    y: 2,
  }));
  assert.equal(fitHistGb(tiny), null);
});

test("HistGB learns a rising vs fading split from receipt windows", () => {
  const examples = [];
  for (let start = 2; start < 20; start++) {
    const up = [start, start + 2, start + 6, start + 12, start + 20];
    examples.push(...examplesFromCounts(up, up.map((n) => n / 80), 0.3, 0.7));
    const down = [start + 20, start + 12, start + 6, start + 2, start];
    examples.push(...examplesFromCounts(down, down.map((n) => n / 80), 0.6, 0.4));
  }
  const model = fitHistGb(examples);
  assert.ok(model);
  assert.ok(model.samples >= MIN_HISTGB_SAMPLES);
  const rising = predictOutlook(model, windowVector([10, 14, 20, 28], 0.2, 0.1, 0.3, 0.7));
  const fading = predictOutlook(model, windowVector([28, 20, 14, 10], 0.1, 0.2, 0.6, 0.4));
  assert.equal(rising, "rising");
  assert.equal(fading, "fading");
});

test("parseHistGbModel rejects junk and round-trips a fit", () => {
  assert.equal(parseHistGbModel(null), null);
  assert.equal(parseHistGbModel({ kind: "stump" }), null);
  assert.equal(parseHistGbModel("histgb"), null);
  assert.equal(
    parseHistGbModel({ kind: "histgb", stumps: [], samples: 16, lr: 0.25 }),
    null,
  );
  assert.ok(
    parseHistGbModel({ kind: "histgb", stumps: [], samples: 16, lr: 0.25, classes: 3 }),
  );
  const examples = [];
  for (let start = 2; start < 20; start++) {
    const up = [start, start + 2, start + 6, start + 12, start + 20];
    examples.push(...examplesFromCounts(up, up.map((n) => n / 80), 0.3, 0.7));
  }
  const model = fitHistGb(examples);
  assert.ok(model);
  const parsed = parseHistGbModel(JSON.parse(JSON.stringify(model)));
  assert.ok(parsed);
  assert.equal(parsed.samples, model.samples);
});

test("fitHistGb on identical features still returns a model and does not invent a WHY", () => {
  const x = windowVector([4, 4, 4, 4], 0.1, 0.1, 0, 0);
  const model = fitHistGb(Array.from({ length: MIN_HISTGB_SAMPLES }, () => ({ x, y: 1 })));
  assert.ok(model);
  assert.equal(model.stumps.length, 0);
  assert.equal(predictOutlook(model, x), "fading");
});

test("occupancy HistGB follows gold official vs occupied tags", () => {
  const examples = [];
  for (let i = 0; i < 24; i++) {
    examples.push({
      x: occupancyVector({ officialHost: true, hasQr: false, titleLen: 40, hostHasBrand: true }),
      y: 1,
    });
    examples.push({
      x: occupancyVector({ officialHost: false, hasQr: true, titleLen: 80, hostHasBrand: false }),
      y: 0,
    });
  }
  const model = fitHistGb(examples, 2);
  assert.ok(model);
  assert.equal(
    predictHistGb(
      model,
      occupancyVector({ officialHost: true, hasQr: false, titleLen: 42, hostHasBrand: true }),
    ),
    1,
  );
  assert.equal(
    predictHistGb(
      model,
      occupancyVector({ officialHost: false, hasQr: true, titleLen: 90, hostHasBrand: false }),
    ),
    0,
  );
});
