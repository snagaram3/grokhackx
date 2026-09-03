import assert from "node:assert/strict";
import { test } from "node:test";
import { asCached, loadInsightRoot, mergePatents, rootCacheId, saveInsightRoot } from "./insights-store";
import type { RootReceipt } from "./insights-types";

function rec(partial: Partial<RootReceipt> & Pick<RootReceipt, "title" | "url">): RootReceipt {
  return { source: "uspto", at: null, snippet: partial.title, ...partial };
}

test("rootCacheId forks Camry senses and empty sense slugs to topic", () => {
  assert.equal(rootCacheId("Camry", "Toyota Camry"), "camry::toyota-camry");
  assert.equal(rootCacheId("Camry", "Camryn Manheim"), "camry::camryn-manheim");
  assert.notEqual(rootCacheId("Camry", "Toyota Camry"), rootCacheId("Camry", "Camryn Manheim"));
  assert.equal(rootCacheId("Camry"), "camry::topic");
  assert.equal(rootCacheId("Camry", ""), "camry::topic");
});

test("asCached drops junk patents and unknown inception sources", () => {
  assert.equal(asCached(null), null);
  assert.equal(asCached("cached"), null);
  const parsed = asCached({
    wikiTitle: "Toyota Camry",
    wikiUrl: 12,
    firstAt: "2004-06-20T00:00:00Z",
    firstEditor: "editor",
    parents: ["Cars introduced in 1982", 1982],
    patents: [
      rec({ title: "Camry body", url: "https://patents.google.com/patent/US4501234" }),
      { title: "no url" },
      "skip",
    ],
    inceptionAt: "1982-01-01T00:00:00.000Z",
    inceptionSource: "rumor",
    inceptionUrl: "https://www.wikidata.org/wiki/Q39973",
    cachedAt: "2026-08-29T00:00:00.000Z",
  });
  assert.equal(parsed?.wikiTitle, "Toyota Camry");
  assert.equal(parsed?.wikiUrl, null);
  assert.deepEqual(parsed?.parents, ["Cars introduced in 1982", "1982"]);
  assert.equal(parsed?.patents.length, 1);
  assert.equal(parsed?.patents[0]?.url.endsWith("US4501234"), true);
  assert.equal(parsed?.inceptionSource, null);
  assert.equal(parsed?.cachedAt, "2026-08-29T00:00:00.000Z");
});

test("asCached fills cachedAt when the persisted row omitted it", () => {
  const parsed = asCached({ wikiTitle: "Toyota Camry" });
  assert.ok(parsed?.cachedAt);
  assert.equal(Number.isNaN(Date.parse(parsed!.cachedAt)), false);
});

test("memory load/save is keyed by query and sense without inventing a WHY", async () => {
  const prevHost = process.env.TREND_DB_HOST;
  const prevUser = process.env.TREND_DB_USER;
  delete process.env.TREND_DB_HOST;
  delete process.env.TREND_DB_USER;
  try {
    const query = "CoverageStoreCamryZz";
    await saveInsightRoot(query, "Toyota Camry", {
      wikiTitle: "Toyota Camry",
      wikiUrl: "https://en.wikipedia.org/wiki/Toyota_Camry",
      firstAt: "2004-06-20T00:00:00Z",
      firstEditor: "editor",
      parents: ["Cars introduced in 1982"],
      patents: [rec({ title: "Camry body", url: "https://patents.google.com/patent/US4501234", at: "1983-04-01T00:00:00Z" })],
      inceptionAt: "1982-01-01T00:00:00.000Z",
      inceptionSource: "wikidata",
      inceptionUrl: "https://www.wikidata.org/wiki/Q39973",
      cachedAt: "2026-08-29T00:00:00.000Z",
    });
    const hit = await loadInsightRoot(query, "Toyota Camry");
    const miss = await loadInsightRoot(query, "Camryn Manheim");
    assert.equal(hit?.wikiTitle, "Toyota Camry");
    assert.equal(hit?.inceptionSource, "wikidata");
    assert.equal(hit?.patents[0]?.at, "1983-04-01T00:00:00Z");
    assert.equal(miss, null);
  } finally {
    if (prevHost === undefined) delete process.env.TREND_DB_HOST;
    else process.env.TREND_DB_HOST = prevHost;
    if (prevUser === undefined) delete process.env.TREND_DB_USER;
    else process.env.TREND_DB_USER = prevUser;
  }
});

test("mergePatents prefers a dated grant over an undated Wikidata stub", () => {
  const stub = rec({ title: "stub", url: "https://patents.google.com/patent/US4501234", at: null });
  const dated = rec({
    title: "Camry body structure",
    url: "https://patents.google.com/patent/US4501234",
    at: "1983-04-01T00:00:00Z",
  });
  const merged = mergePatents([stub], [dated]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.at, "1983-04-01T00:00:00Z");
});
