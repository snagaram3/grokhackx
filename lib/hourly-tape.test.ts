import assert from "node:assert/strict";
import { test } from "node:test";
import { snapCachedTape } from "./hourly-collect";
import type { TrendsPayload } from "./types";

function tape(plugged?: string): TrendsPayload {
  return {
    topics: [],
    updatedAt: "2026-08-26T12:00:00.000Z",
    sources: { x: false, reddit: false, hn: false, public: true },
    degraded: [],
    plugged,
  };
}

test("snapCachedTape only snaps the cached tape when the watchlist is empty", () => {
  assert.equal(snapCachedTape([], tape("Camry")), true);
  assert.equal(snapCachedTape([], tape()), true);
  assert.equal(snapCachedTape([], null), false);
  assert.equal(snapCachedTape([], undefined), false);
  assert.equal(snapCachedTape(["Camry"], tape("Camry")), false);
  assert.equal(snapCachedTape(["Camry"], null), false);
});
