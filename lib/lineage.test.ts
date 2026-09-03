import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDataLineage,
  formatCollectedAt,
  formatLineageSection,
  lineageLine,
  stampPost,
  stampSource,
} from "./lineage";
import type { POIData, PublicDataSource } from "./insights-types";
import type { Post, ResearchSource } from "./types";

function poi(): POIData {
  return {
    id: "camry",
    label: "Camry",
    category: "automotive",
    keywords: ["camry"],
    dataPoints: 3,
    relevanceScore: 0.7,
  };
}

function source(name: string, reliability: number): PublicDataSource {
  return {
    id: name,
    name,
    platform: "public",
    category: "news",
    dataPoints: 4,
    lastUpdated: "2026-08-26T12:00:00.000Z",
    reliability,
  };
}

test("stampPost and stampSource keep existing lineage stamps", () => {
  const post: Post = {
    platform: "public",
    title: "Camry",
    url: "https://nhtsa.test/camry",
    score: 10,
    createdAt: "2026-08-26T12:00:00.000Z",
    tool: "collect_nhtsa",
    collectedAt: "2026-08-21T00:00:00.000Z",
  };
  const stamped = stampPost(post, "collect_other");
  assert.equal(stamped.tool, "collect_nhtsa");
  assert.equal(stamped.collectedAt, "2026-08-21T00:00:00.000Z");

  const fresh = stampPost({ ...post, tool: undefined, collectedAt: undefined }, "collect_gdelt");
  assert.equal(fresh.tool, "collect_gdelt");
  assert.ok(fresh.collectedAt);

  const src: ResearchSource = {
    id: "w1",
    kind: "wikipedia",
    title: "Camry",
    url: "https://en.wikipedia.org/wiki/Camry",
    snippet: "car",
  };
  const withDefault = stampSource(src);
  assert.equal(withDefault.tool, "research_wikipedia");
});

test("formatCollectedAt and lineageLine stay empty without a stamp", () => {
  assert.equal(formatCollectedAt(), "");
  assert.equal(formatCollectedAt("not-a-date"), "");
  assert.equal(formatCollectedAt("2026-08-26T12:00:00.000Z"), "2026-08-26 12:00Z");
  assert.equal(lineageLine({}), "");
  assert.equal(
    lineageLine({ tool: "collect_nws", sourceApi: "National Weather Service", collectedAt: "2026-08-26T12:00:00.000Z" }),
    "collect_nws · National Weather Service · 2026-08-26 12:00Z",
  );
});

test("formatLineageSection lists receipts and an empty pack", () => {
  const empty = formatLineageSection([]);
  assert.ok(empty.some((l) => l === "No receipts to lineage."));
  const rows = formatLineageSection([
    {
      title: "Camry recall",
      url: "https://nhtsa.test/camry",
      tool: "collect_nhtsa",
      collectedAt: "2026-08-26T12:00:00.000Z",
      channel: "public",
    },
  ]);
  assert.ok(rows.some((l) => l.includes("Camry recall")));
  assert.ok(rows.some((l) => l.includes("collect_nhtsa")));
  assert.ok(rows.some((l) => l.includes("https://nhtsa.test/camry")));
});

test("buildDataLineage treats reliability > 0.8 as organic and 0.6 as the floor", () => {
  const empty = buildDataLineage({ publicSources: [], poiData: poi() });
  assert.equal(empty.originId, "origin-camry");
  assert.equal(empty.traceDepth, 0);
  assert.equal(empty.organicScore, 0);
  assert.equal(empty.isOrganic, false);

  const borderline = buildDataLineage({
    publicSources: [source("wiki", 0.8), source("news", 0.5)],
    poiData: poi(),
  });
  assert.equal(borderline.steps[0].verified, false);
  assert.equal(borderline.organicScore, 0);
  assert.equal(borderline.isOrganic, false);

  const mixed = buildDataLineage({
    publicSources: [source("nhtsa", 0.9), source("wiki", 0.91), source("blog", 0.4)],
    poiData: poi(),
  });
  assert.equal(mixed.steps.filter((s) => s.verified).length, 2);
  assert.ok(mixed.organicScore > 0.6);
  assert.equal(mixed.isOrganic, true);
  assert.equal(mixed.traceDepth, 3);

  const half = buildDataLineage({
    publicSources: [source("nhtsa", 0.9), source("blog", 0.4)],
    poiData: poi(),
  });
  assert.equal(half.organicScore, 0.5);
  assert.equal(half.isOrganic, false);
});
