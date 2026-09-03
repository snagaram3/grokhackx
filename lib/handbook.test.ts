import assert from "node:assert/strict";
import { test } from "node:test";
import { FLEET_GRAPH, LINEAGE_GRAPH, ML_GRAPH } from "./architecture-diagrams";
import { MIN_HISTGB_SAMPLES, MIN_OCCUPANCY_LABELS, MODEL_CARD } from "./histgb";
import { HANDBOOK_FLOORS } from "./handbook-types";
import { diffPermissions, handbookMarkdown } from "./handbook";
import type { HandbookPayload } from "./handbook-types";

test("handbook floors stay locked to HistGB abstain counts", () => {
  assert.equal(HANDBOOK_FLOORS.minTransitions, MIN_HISTGB_SAMPLES);
  assert.equal(HANDBOOK_FLOORS.minGoldTags, MIN_OCCUPANCY_LABELS);
  assert.equal(HANDBOOK_FLOORS.minTransitions, 16);
  assert.equal(HANDBOOK_FLOORS.minGoldTags, 20);
});

test("diffPermissions treats a missing previous render as the baseline", () => {
  const current = { tools: { collect_hn: { enabled: true } } };
  const first = diffPermissions(null, current);
  assert.equal(first.summary, "No previous render. This pass is the baseline.");
  assert.deepEqual(first.changes, []);
});

test("diffPermissions reports on/off flips including added and dropped tools", () => {
  const unchanged = diffPermissions(
    { tools: { collect_hn: { enabled: true } } },
    { tools: { collect_hn: { enabled: true } } },
  );
  assert.equal(unchanged.summary, "No change since last handbook render.");
  assert.equal(unchanged.changes.length, 0);

  const missingEnabled = diffPermissions(
    { tools: { collect_hn: { enabled: false } } },
    { tools: { collect_hn: {} } },
  );
  assert.equal(missingEnabled.changes.length, 0);

  const flipped = diffPermissions(
    {
      tools: {
        collect_hn: { enabled: true },
        collect_public_apis: { enabled: true },
        score_and_dedup: { enabled: false },
      },
    },
    {
      tools: {
        collect_hn: { enabled: false },
        score_and_dedup: { enabled: true },
        new_tool: { enabled: true },
      },
    },
  );
  assert.equal(flipped.summary, "4 tools flipped.");
  assert.deepEqual(flipped.changes, [
    { tool: "collect_hn", from: "on", to: "off" },
    { tool: "collect_public_apis", from: "on", to: "off" },
    { tool: "new_tool", from: "off", to: "on" },
    { tool: "score_and_dedup", from: "off", to: "on" },
  ]);

  const one = diffPermissions(
    { tools: { collect_hn: { enabled: true } } },
    { tools: { collect_hn: { enabled: false } } },
  );
  assert.equal(one.summary, "1 tool flipped.");
});

test("handbookMarkdown prints the permission table, mermaid, and fit floors without inventing a WHY", () => {
  const payload: HandbookPayload = {
    generatedAt: "2026-09-01T10:00:00.000Z",
    product: ["GET /api/trends stays the tape."],
    permissions: {
      tools: {
        collect_hn: { enabled: true, channel: "hn", note: "HN Algolia." },
        score_and_dedup: { enabled: false, channel: "all" },
      },
    },
    permissionDiff: {
      summary: "1 tool flipped.",
      changes: [{ tool: "score_and_dedup", from: "on", to: "off" }],
    },
    modelCard: {
      ...MODEL_CARD,
      minTransitions: HANDBOOK_FLOORS.minTransitions,
      minGoldTags: HANDBOOK_FLOORS.minGoldTags,
    },
    mermaid: { fleet: FLEET_GRAPH, ml: ML_GRAPH, lineage: LINEAGE_GRAPH },
    files: ["lib/histgb.ts", "fleet/permissions.json"],
  };
  const md = handbookMarkdown(payload);
  assert.match(md, /^# HawkxAI handbook/);
  assert.match(md, /Generated 2026-09-01T10:00:00.000Z/);
  assert.match(md, /Not an invented WHY/);
  assert.match(md, /GET \/api\/trends stays the tape/);
  assert.match(md, /\| `collect_hn` \| true \| hn \| HN Algolia\. \|/);
  assert.match(md, /\| `score_and_dedup` \| false \| all \|  \|/);
  assert.match(md, /1 tool flipped/);
  assert.match(md, /`score_and_dedup`: on → off/);
  assert.match(md, /Fit floors: 16 transitions · 20 gold tags/);
  assert.match(md, /```mermaid\nflowchart LR/);
  assert.match(md, /HistGB next-window and occupancy/);
  assert.match(md, /Post\.tool \+ collectedAt/);
  assert.match(md, /- `lib\/histgb\.ts`/);
  assert.doesNotMatch(md, /invented WHY that/);
});
