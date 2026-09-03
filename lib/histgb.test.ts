import assert from "node:assert/strict";
import { test } from "node:test";
import {
  examplesFromCounts,
  fitHistGb,
  MIN_HISTGB_SAMPLES,
  occupancyVector,
  parseHistGbModel,
  predictHistGb,
  predictOutlook,
  windowVector,
} from "./histgb";

test("examplesFromCounts skips the latest pair so the last window is held out", () => {
  const counts = [2, 4, 8, 16, 32];
  const examples = examplesFromCounts(counts, counts.map((n) => n / 100), 0.4, 0.6);
  assert.ok(examples.length >= 1);
  assert.ok(examples.every((e) => e.x.length === 8));
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
