import assert from "node:assert/strict";
import { test } from "node:test";
import {
  diffSnapshots,
  ingestTape,
  mergeWatchStores,
  parseWatchStore,
  receiptCount,
  snapshotOf,
  toggleWatch,
  type TapeSnapshot,
  type TapeWatchStore,
} from "./watch";
import type { BoosterTopicBrief, Topic } from "./types";

function snap(id: string, at: string, receipts: number): TapeSnapshot {
  return {
    topicId: id,
    label: id,
    velocity: "rising",
    lean: "thin",
    pos: 0,
    neg: 0,
    receiptCount: receipts,
    firstAt: null,
    at,
  };
}

test("mergeWatchStores unions ids and keeps the later snap", () => {
  const local: TapeWatchStore = {
    ids: ["camry"],
    snaps: { camry: snap("camry", "2026-08-26T08:00:00Z", 4) },
  };
  const remote: TapeWatchStore = {
    ids: ["camry", "tesla"],
    snaps: {
      camry: snap("camry", "2026-08-26T09:00:00Z", 7),
      tesla: snap("tesla", "2026-08-26T07:00:00Z", 2),
    },
  };
  const merged = mergeWatchStores(local, remote);
  assert.deepEqual(merged.ids.toSorted(), ["camry", "tesla"]);
  assert.equal(merged.snaps.camry.receiptCount, 7);
  assert.equal(merged.snaps.tesla.receiptCount, 2);
});

test("parseWatchStore returns empty on null, garbage, and non-string ids", () => {
  assert.deepEqual(parseWatchStore(null), { ids: [], snaps: {} });
  assert.deepEqual(parseWatchStore("{not json"), { ids: [], snaps: {} });
  assert.deepEqual(parseWatchStore(JSON.stringify({ ids: ["camry", 12, null], snaps: "nope" })), {
    ids: ["camry"],
    snaps: {},
  });
  const ok = parseWatchStore(
    JSON.stringify({
      ids: ["camry"],
      snaps: { camry: snap("camry", "2026-08-26T09:00:00Z", 3) },
    }),
  );
  assert.deepEqual(ok.ids, ["camry"]);
  assert.equal(ok.snaps.camry.receiptCount, 3);
});

test("diffSnapshots reports measured moves only and stays empty when nothing changed", () => {
  const prev = snap("camry", "2026-08-26T08:00:00Z", 4);
  assert.deepEqual(diffSnapshots(prev, { ...prev, at: "later" }), []);
  assert.deepEqual(diffSnapshots(prev, { ...prev, velocity: "peaking" }), ["rising → peaking"]);
  assert.ok(
    diffSnapshots(prev, { ...prev, lean: "neg", pos: 0, neg: 3 }).some((l) =>
      l.includes("titles thin → neg"),
    ),
  );
  assert.deepEqual(diffSnapshots(prev, { ...prev, pos: 2, neg: 1 }), [
    "titles 2 pos / 1 neg (was 0/0)",
  ]);
  assert.deepEqual(diffSnapshots(prev, { ...prev, receiptCount: 7 }), ["receipts 4 → 7 (+3)"]);
  assert.deepEqual(diffSnapshots(prev, { ...prev, receiptCount: 2 }), ["receipts 4 → 2 (-2)"]);
  assert.deepEqual(diffSnapshots(prev, { ...prev, firstAt: "2026-08-26T07:00:00Z" }), [
    "first print 2026-08-26T07:00:00Z",
  ]);
});

test("toggleWatch adds then removes without duplicating", () => {
  const empty: TapeWatchStore = { ids: [], snaps: {} };
  const added = toggleWatch(empty, "camry");
  assert.deepEqual(added.ids, ["camry"]);
  const again = toggleWatch(added, "camry");
  assert.deepEqual(again.ids, []);
  const two = toggleWatch(toggleWatch(empty, "camry"), "tesla");
  assert.deepEqual(two.ids, ["camry", "tesla"]);
});

function emptySlice() {
  return { score: 0, posts: [] as Topic["platforms"]["public"]["posts"] };
}

function topicWithPosts(id: string, titles: string[]): Topic {
  return {
    id,
    label: id,
    velocity: "rising",
    divergence: 0.5,
    tickers: [],
    platforms: {
      x: emptySlice(),
      reddit: emptySlice(),
      hn: emptySlice(),
      public: {
        score: titles.length * 10,
        posts: titles.map((title, i) => ({
          platform: "public" as const,
          title,
          url: `https://a.test/${id}/${i}`,
          score: 10,
          createdAt: "2026-08-26T08:00:00Z",
        })),
      },
    },
  };
}

function brief(topicId: string, lean: TapeSnapshot["lean"], pos: number, neg: number, firstAt: string | null): BoosterTopicBrief {
  return {
    topicId,
    whyTrending: "measured",
    confidence: 0.4,
    category: "markets",
    artifacts: [],
    audiences: [],
    campaign: {
      angle: "",
      forCompetitors: "",
      risk: "low",
      timing: "rising",
      hook: "",
    },
    causation: {
      topicId,
      firstAt,
      firstPlatform: firstAt ? "public" : null,
      lagHours: null,
      peakAt: null,
      drivers: [],
      thin: !firstAt,
    },
    sentiment: {
      topicId,
      lean,
      overall: { pos, neg, risk: 0, n: pos + neg },
      byPlatform: {},
      drivers: [],
      quotes: [],
      hits: [],
      thin: pos + neg < 2,
    },
  };
}

test("receiptCount and snapshotOf copy tape + brief without inventing a why", () => {
  const topic = topicWithPosts("camry", ["Camry hybrid", "Camry recall"]);
  assert.equal(receiptCount(topic), 2);
  const shot = snapshotOf(topic, brief("camry", "neg", 0, 2, "2026-08-26T07:00:00Z"), "2026-08-26T09:00:00Z");
  assert.equal(shot.topicId, "camry");
  assert.equal(shot.lean, "neg");
  assert.equal(shot.neg, 2);
  assert.equal(shot.receiptCount, 2);
  assert.equal(shot.firstAt, "2026-08-26T07:00:00Z");
  assert.equal(snapshotOf(topic, undefined, "2026-08-26T09:00:00Z").lean, "thin");
});

test("ingestTape drops missing ids, auto-stars, and emits receipt deltas", () => {
  const camry = topicWithPosts("camry", ["Camry a", "Camry b", "Camry c"]);
  const tesla = topicWithPosts("tesla", ["Tesla"]);
  const prior: TapeWatchStore = {
    ids: ["camry", "gone"],
    snaps: { camry: snap("camry", "2026-08-26T08:00:00Z", 1) },
  };
  const { store, deltas } = ingestTape(
    prior,
    [camry, tesla],
    [brief("camry", "thin", 0, 0, null)],
    "2026-08-26T09:00:00Z",
    "tesla",
  );
  assert.deepEqual(store.ids.toSorted(), ["camry", "tesla"]);
  assert.equal(store.snaps.camry.receiptCount, 3);
  assert.equal(store.snaps.tesla.receiptCount, 1);
  assert.equal(deltas.length, 1);
  assert.equal(deltas[0].topicId, "camry");
  assert.ok(deltas[0].lines.some((l) => l.includes("receipts 1 → 3")));

  const quiet = ingestTape(store, [camry, tesla], [brief("camry", "thin", 0, 0, null)], "2026-08-26T10:00:00Z");
  assert.equal(quiet.deltas.length, 0);
});
