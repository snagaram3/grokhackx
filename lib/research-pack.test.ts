import assert from "node:assert/strict";
import { test } from "node:test";
import {
  anglesFromSources,
  clusterSenses,
  isFirstPartyHost,
  packResearch,
  packSummary,
  sliceResearchPayload,
  sourceHitsQuery,
  splitOnQuery,
  wikiTitleFromUrl,
} from "./research-pack";
import type { ResearchPayload, ResearchSource } from "./types";

function src(
  partial: Partial<ResearchSource> & Pick<ResearchSource, "id" | "kind" | "title" | "url">,
): ResearchSource {
  return { snippet: partial.title, ...partial };
}

const appleWiki = src({
  id: "wikipedia-1",
  kind: "wikipedia",
  title: "Apple",
  url: "https://en.wikipedia.org/wiki/Apple",
  snippet: "An apple is the round, edible fruit of an apple tree.",
});
const appleInc = src({
  id: "wikipedia-2",
  kind: "wikipedia",
  title: "Apple Inc.",
  url: "https://en.wikipedia.org/wiki/Apple_Inc.",
  snippet: "Wikipedia page: Apple Inc.",
});
const appleWatch = src({
  id: "wikipedia-3",
  kind: "wikipedia",
  title: "Apple Watch",
  url: "https://en.wikipedia.org/wiki/Apple_Watch",
});
const pubmed = src({
  id: "pubmed-1",
  kind: "pubmed",
  title: "Apple MdZAT5 mediates root development under drought stress.",
  url: "https://pubmed.ncbi.nlm.nih.gov/38879984/",
  snippet: "Plant Physiol Biochem · 2024/08/01 00:00 · Apple MdZAT5 mediates root development under drought stress.",
});
const doj = src({
  id: "hn-1",
  kind: "hn",
  title: "U.S. sues Apple, accusing it of maintaining an iPhone monopoly",
  url: "https://www.nytimes.com/2024/03/21/technology/apple-doj-lawsuit-antitrust.html",
  createdAt: "2024-03-21T00:00:00Z",
});
const newsroom = src({
  id: "hn-2",
  kind: "hn",
  title: "Apple announces changes to iOS, Safari, and the App Store in the European Union",
  url: "https://www.apple.com/newsroom/2024/01/apple-announces-changes-to-ios-safari-and-the-app-store-in-the-european-union/",
  createdAt: "2024-01-25T00:00:00Z",
});
const worldnews = src({
  id: "reddit-1",
  kind: "reddit",
  title: "/r/WorldNews Live Thread: Russian Invasion of Ukraine Day 1645, Part 1",
  url: "https://www.reddit.com/r/worldnews/comments/1vyma6f/rworldnews_live_thread_russian_invasion_of/",
});

test("isFirstPartyHost matches apple.com for apple and ignores wikipedia.org", () => {
  assert.equal(isFirstPartyHost("https://www.apple.com/newsroom/", "apple"), true);
  assert.equal(isFirstPartyHost("https://en.wikipedia.org/wiki/Apple", "apple"), false);
  assert.equal(isFirstPartyHost("not a url", "apple"), false);
});

test("packSummary stays evidence-only when every receipt is off-query", () => {
  assert.match(packSummary("apple", 0, 3, null), /No on-query receipts/);
  assert.match(packSummary("apple", 0, 3, null), /Dropped 3 unrelated/);
  assert.match(packSummary("apple", 2, 0, null), /Collected 2 live receipts/);
  assert.equal(/Dropped/.test(packSummary("apple", 2, 0, null)), false);
});

test("wikiTitleFromUrl decodes Inc. and Watch", () => {
  assert.equal(wikiTitleFromUrl("https://en.wikipedia.org/wiki/Apple_Inc."), "Apple Inc.");
  assert.equal(wikiTitleFromUrl("https://en.wikipedia.org/wiki/Apple_Watch"), "Apple Watch");
});

test("worldnews without apple is off-query; wiki and pubmed hit", () => {
  assert.equal(sourceHitsQuery(worldnews, "apple"), false);
  assert.equal(sourceHitsQuery(appleWiki, "apple"), true);
  assert.equal(sourceHitsQuery(pubmed, "apple"), true);
  assert.equal(sourceHitsQuery(doj, "apple"), true);
});

test("splitOnQuery drops reddit worldnews for apple", () => {
  const { kept, dropped } = splitOnQuery("apple", [
    appleWiki,
    appleInc,
    pubmed,
    doj,
    worldnews,
  ]);
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0].id, "reddit-1");
  assert.equal(kept.length, 4);
});

test("clusterSenses splits fruit pubmed from Inc. news", () => {
  const senses = clusterSenses("apple", [appleWiki, appleInc, appleWatch, pubmed, doj, newsroom]);
  const fruit = senses.find((s) => s.label === "Apple");
  const inc = senses.find((s) => s.label === "Apple Inc.");
  assert.ok(fruit);
  assert.ok(inc);
  assert.ok(fruit!.sourceIds.includes("pubmed-1"));
  assert.ok(inc!.sourceIds.includes("hn-1"));
  assert.ok(inc!.sourceIds.includes("hn-2"));
  assert.ok(inc!.count >= fruit!.count);
});

test("packResearch defaults Copy to denser Inc. sense and counts dropped", () => {
  const pack = packResearch("apple", [
    appleWiki,
    appleInc,
    appleWatch,
    pubmed,
    doj,
    newsroom,
    worldnews,
  ]);
  assert.equal(pack.droppedCount, 1);
  assert.equal(pack.defaultSense?.label, "Apple Inc.");
  assert.ok(pack.summary.includes("Dropped 1 unrelated"));
  assert.ok(pack.summary.includes("Apple Inc."));
  assert.ok(pack.angles.some((a) => a.startsWith("Timeline:")));
  assert.ok(pack.angles.some((a) => a.startsWith("Primary sources:")));
  assert.ok(pack.angles.some((a) => a.startsWith("Open disputes:")));
  assert.ok(pack.openQuestions.length >= 1);
});

test("angles stay empty when receipts have no dates or disputes", () => {
  const { angles, openQuestions } = anglesFromSources("camry", [
    src({
      id: "w-1",
      kind: "wikipedia",
      title: "Toyota Camry",
      url: "https://en.wikipedia.org/wiki/Toyota_Camry",
    }),
  ]);
  assert.equal(angles.some((a) => a.startsWith("Timeline:")), false);
  assert.equal(openQuestions.length, 0);
  assert.ok(angles.some((a) => a.startsWith("Primary sources:")));
});

test("sliceResearchPayload keeps only the chosen sense", () => {
  const pack = packResearch("apple", [appleWiki, appleInc, pubmed, doj, worldnews]);
  const payload: ResearchPayload = {
    query: "apple",
    updatedAt: "2026-08-26T00:00:00Z",
    summary: pack.summary,
    findings: [{ claim: "DOJ sued Apple", evidenceIds: ["hn-1"], confidence: "medium" }],
    openQuestions: pack.openQuestions,
    angles: pack.angles,
    sources: pack.kept,
    degraded: [],
    thin: false,
    droppedCount: pack.droppedCount,
    dropped: pack.dropped,
    senses: pack.senses,
    defaultSenseId: pack.defaultSense?.id ?? null,
  };
  const fruit = pack.senses.find((s) => s.label === "Apple");
  assert.ok(fruit);
  const sliced = sliceResearchPayload(payload, fruit!.id);
  assert.ok(sliced.sources.every((s) => fruit!.sourceIds.includes(s.id)));
  assert.equal(
    sliced.findings.some((f) => f.evidenceIds.includes("hn-1")),
    false,
  );
});
