import assert from "node:assert/strict";
import { test } from "node:test";
import { mergePatents } from "./insights-store";
import {
  assembleRoots,
  extractBirthYear,
  inceptionFromParents,
  keepCategory,
  measureOriginLag,
  oldestReceipt,
  patentsFromLegacy,
  patentsFromV2,
  pickFirstRecord,
  pickSenseTitle,
  resolveInception,
  usptoV2Url,
  wikidataEntityUrl,
  wikidataTime,
  wikiPagepropsUrl,
  yearIso,
} from "./insights-roots";
import type { RootReceipt } from "./insights-types";

function rec(partial: Partial<RootReceipt> & Pick<RootReceipt, "title" | "url">): RootReceipt {
  return { source: "web", at: null, snippet: partial.title, ...partial };
}

const emptyInception = {
  inceptionAt: null as string | null,
  inceptionSource: null as null,
  inceptionUrl: null as string | null,
};

test("keepCategory drops wiki housekeeping and keeps family strata", () => {
  assert.equal(keepCategory("Category:Toyota vehicles"), true);
  assert.equal(keepCategory("Compact cars"), true);
  assert.equal(keepCategory("All stub articles"), false);
  assert.equal(keepCategory("Wikipedia articles needing cleanup"), false);
  assert.equal(keepCategory("CS1 errors"), false);
});

test("oldestReceipt ignores undated rows and picks the earliest ISO", () => {
  const a = rec({ title: "new", url: "https://a.test/n", at: "2024-01-01T00:00:00Z" });
  const b = rec({ title: "old", url: "https://a.test/o", at: "1997-06-01T00:00:00Z" });
  const none = rec({ title: "undated", url: "https://a.test/u", at: null });
  const junk = rec({ title: "junk", url: "https://a.test/j", at: "not-a-date" });
  assert.equal(oldestReceipt([a, none, b])?.title, "old");
  assert.equal(oldestReceipt([none]), null);
  assert.equal(oldestReceipt([junk, a])?.title, "new");
});

test("extractBirthYear and parent year read claimed origin without inventing a WHY", () => {
  assert.equal(extractBirthYear("The Toyota Camry has been sold internationally since 1982."), 1982);
  assert.equal(extractBirthYear("first launched in 1997 as a compact."), 1997);
  assert.equal(extractBirthYear("A car with 305000 miles."), null);
  assert.equal(inceptionFromParents(["Toyota vehicles", "Cars introduced in 1982"]), 1982);
  assert.equal(inceptionFromParents(["Compact cars"]), null);
});

test("pickSenseTitle forks Camry vs Camryn Manheim", () => {
  const senses = [
    { title: "Toyota Camry", url: "https://en.wikipedia.org/wiki/Toyota_Camry" },
    { title: "Camryn Manheim", url: "https://en.wikipedia.org/wiki/Camryn_Manheim" },
  ];
  assert.equal(pickSenseTitle(senses, null)?.title, "Toyota Camry");
  assert.equal(pickSenseTitle(senses, "camryn-manheim")?.title, "Camryn Manheim");
  assert.equal(pickSenseTitle(senses, "Camryn Manheim")?.title, "Camryn Manheim");
});

test("pickFirstRecord prefers an older USPTO grant over a later wiki edit", () => {
  const wiki = rec({
    title: "wiki 2004",
    url: "https://en.wikipedia.org/wiki/Toyota_Camry",
    source: "wikipedia",
    at: "2004-06-20T00:00:00Z",
  });
  const patent = rec({
    title: "Camry body grant",
    url: "https://patents.google.com/patent/US4501234",
    source: "uspto",
    at: "1983-04-01T00:00:00Z",
  });
  const laterPaper = rec({
    title: "Camry paper",
    url: "https://pubmed.example/1",
    source: "pubmed",
    at: "2018-01-01T00:00:00Z",
  });
  assert.equal(pickFirstRecord(wiki, [laterPaper, patent])?.source, "uspto");
  assert.equal(pickFirstRecord(wiki, [laterPaper])?.source, "wikipedia");
});

test("measureOriginLag is a year gap, never a story", () => {
  const lag = measureOriginLag(yearIso(1982), "wikidata", "https://www.wikidata.org/wiki/Q39973", "2004-06-20T04:15:36Z");
  assert.equal(lag?.lagYears, 22);
  assert.equal(lag?.claimedSource, "wikidata");
  assert.equal(measureOriginLag(yearIso(2004), "extract", null, "2004-06-20T00:00:00Z"), null);
});

test("mergePatents keeps the older grant per url", () => {
  const older = rec({ title: "a", url: "https://p.test/1", source: "uspto", at: "1983-01-01T00:00:00Z" });
  const newer = rec({ title: "b", url: "https://p.test/1", source: "uspto", at: "1999-01-01T00:00:00Z" });
  const extra = rec({ title: "c", url: "https://p.test/2", source: "uspto", at: "1991-01-01T00:00:00Z" });
  const merged = mergePatents([newer], [older, extra]);
  assert.equal(merged.length, 2);
  assert.equal(merged.find((p) => p.url.endsWith("/1"))?.at, "1983-01-01T00:00:00Z");
});

test("assembleRoots builds a taproot: plug → origin → parent → first record, never invents WHY", () => {
  const trace = assembleRoots({
    query: "Camry",
    wiki: {
      title: "Toyota Camry",
      url: "https://en.wikipedia.org/wiki/Toyota_Camry",
      extract: "The Toyota Camry is an automobile sold internationally by Toyota since 1982.",
      senses: [
        { title: "Toyota Camry", url: "https://en.wikipedia.org/wiki/Toyota_Camry" },
        { title: "Camryn Manheim", url: "https://en.wikipedia.org/wiki/Camryn_Manheim" },
      ],
    },
    wikiRoot: {
      firstAt: "2003-02-01T00:00:00Z",
      firstEditor: "editor",
      parents: ["Toyota vehicles", "All articles", "Cars introduced in 1982"],
    },
    abstract: null,
    dated: [
      rec({
        title: "Camry hybrid recall notice",
        url: "https://pubmed.example/1",
        source: "pubmed",
        at: "2018-04-01T00:00:00Z",
      }),
      rec({
        title: "camera sensor firmware",
        url: "https://pubmed.example/2",
        source: "pubmed",
        at: "1990-01-01T00:00:00Z",
      }),
    ],
    tape: [
      rec({
        title: "New Camry trim leaked",
        url: "https://news.ycombinator.com/item?id=1",
        source: "hn",
        at: "2024-08-01T00:00:00Z",
      }),
    ],
    ...emptyInception,
    inceptionAt: yearIso(1982),
    inceptionSource: "wikidata",
    inceptionUrl: "https://www.wikidata.org/wiki/Q39973",
    degraded: [],
  });

  assert.equal(trace.thin, false);
  assert.equal(trace.originTitle, "Toyota Camry");
  assert.equal(trace.senseId, "toyota-camry");
  assert.equal(trace.senses.length, 2);
  assert.match(trace.originExtract ?? "", /automobile/);
  assert.deepEqual(
    trace.parents.map((p) => p.label),
    ["Toyota vehicles", "Cars introduced in 1982"],
  );
  assert.equal(trace.firstRecord?.source, "wikipedia");
  assert.equal(trace.originLag?.lagYears, 21);
  assert.ok(!trace.receipts.some((r) => /camera sensor/i.test(r.title)));
  assert.deepEqual(
    trace.layers.map((l) => l.kind),
    ["plug", "sense", "tape", "origin", "parent", "first-record", "lag"],
  );
  assert.match(trace.layers.find((l) => l.kind === "lag")?.detail ?? "", /Measured gap/);
});

test("assembleRoots prefers a product grant as the root when it predates the wiki edit", () => {
  const trace = assembleRoots({
    query: "Camry",
    wiki: {
      title: "Toyota Camry",
      url: "https://en.wikipedia.org/wiki/Toyota_Camry",
      extract: "The Toyota Camry is an automobile sold since 1982.",
      senses: [{ title: "Toyota Camry", url: "https://en.wikipedia.org/wiki/Toyota_Camry" }],
    },
    wikiRoot: { firstAt: "2004-06-20T00:00:00Z", firstEditor: null, parents: [] },
    abstract: null,
    dated: [
      rec({
        title: "Camry body structure",
        url: "https://patents.google.com/patent/US4501234",
        source: "uspto",
        at: "1983-04-01T00:00:00Z",
      }),
    ],
    tape: [],
    ...emptyInception,
    degraded: [],
  });
  assert.equal(trace.firstRecord?.source, "uspto");
  assert.match(trace.layers.find((l) => l.kind === "first-record")?.label ?? "", /product grant/);
});

test("wikidataTime reads +YYYY-MM-DD and rejects out-of-range years", () => {
  assert.equal(wikidataTime("+1982-01-01T00:00:00Z"), "1982-01-01T00:00:00.000Z");
  assert.equal(wikidataTime("-0500-01-01T00:00:00Z"), null);
  assert.equal(wikidataTime("+2201-01-01T00:00:00Z"), null);
  assert.equal(wikidataTime("sometime in 1982"), null);
  assert.equal(wikidataTime(undefined), null);
});

test("patentsFromLegacy and patentsFromV2 skip incomplete rows and keep dates", () => {
  const legacy = patentsFromLegacy({
    patents: [
      { patent_number: "4501234", patent_title: "Camry body", patent_date: "1983-04-01", patent_abstract: "A body." },
      { patent_number: "999", patent_title: "" },
      { patent_title: "no number" },
    ],
  });
  assert.equal(legacy.length, 1);
  assert.equal(legacy[0]?.url, "https://patents.google.com/patent/US4501234");
  assert.equal(legacy[0]?.at, "1983-04-01");
  assert.equal(legacy[0]?.source, "uspto");

  const v2 = patentsFromV2({
    patents: [
      { patent_id: "US4501234", patent_title: "Camry body structure", patent_date: "1983-04-01" },
      { patent_id: "", patent_title: "empty id" },
    ],
  });
  assert.equal(v2.length, 1);
  assert.equal(v2[0]?.url, "https://patents.google.com/patent/US4501234");
});

test("resolveInception prefers Wikidata, then cache, then category year, then extract", () => {
  const wiki = {
    title: "Toyota Camry",
    url: "https://en.wikipedia.org/wiki/Toyota_Camry",
    extract: "The Toyota Camry has been sold internationally since 1982.",
    senses: [],
  };
  const wikiRoot = { firstAt: "2004-06-20T00:00:00Z", firstEditor: null, parents: ["Cars introduced in 1982"] };
  const cached = {
    wikiTitle: wiki.title,
    wikiUrl: wiki.url,
    firstAt: wikiRoot.firstAt,
    firstEditor: null,
    parents: wikiRoot.parents,
    patents: [] as RootReceipt[],
    inceptionAt: "1983-01-01T00:00:00.000Z",
    inceptionSource: "extract" as const,
    inceptionUrl: wiki.url,
    cachedAt: "2026-08-29T00:00:00.000Z",
  };

  const fromWiki = resolveInception(wiki, wikiRoot, { at: "1982-01-01T00:00:00.000Z", url: "https://www.wikidata.org/wiki/Q39973" }, cached);
  assert.equal(fromWiki.source, "wikidata");
  assert.equal(fromWiki.at, "1982-01-01T00:00:00.000Z");

  const fromCache = resolveInception(wiki, wikiRoot, null, cached);
  assert.equal(fromCache.source, "extract");
  assert.equal(fromCache.at, "1983-01-01T00:00:00.000Z");

  const fromCategory = resolveInception(wiki, wikiRoot, null, null);
  assert.equal(fromCategory.source, "category");
  assert.equal(fromCategory.at, yearIso(1982));

  const fromExtract = resolveInception(wiki, { firstAt: null, firstEditor: null, parents: ["Compact cars"] }, null, null);
  assert.equal(fromExtract.source, "extract");
  assert.equal(fromExtract.at, yearIso(1982));

  const none = resolveInception(null, null, null, null);
  assert.deepEqual(none, { at: null, source: null, url: null });
});

test("assembleRoots uses a DuckDuckGo abstract when Wikipedia is offline", () => {
  const trace = assembleRoots({
    query: "Camry",
    wiki: null,
    wikiRoot: null,
    abstract: {
      title: "Toyota Camry",
      url: "https://en.wikipedia.org/wiki/Toyota_Camry",
      snippet: "The Toyota Camry is an automobile sold internationally by Toyota since 1982.",
    },
    dated: [],
    tape: [],
    ...emptyInception,
    degraded: ["wikipedia offline"],
  });
  assert.equal(trace.thin, false);
  assert.equal(trace.originTitle, "Toyota Camry");
  assert.match(trace.originExtract ?? "", /automobile/);
  assert.ok(trace.layers.some((l) => l.kind === "origin"));
  assert.ok(trace.degraded.includes("wikipedia offline"));
});

test("assembleRoots stays thin when there is no extract and no dated record", () => {
  const trace = assembleRoots({
    query: "zzzxqnotathing",
    wiki: null,
    wikiRoot: null,
    abstract: null,
    dated: [],
    tape: [],
    ...emptyInception,
    degraded: ["wikipedia offline"],
  });
  assert.equal(trace.thin, true);
  assert.equal(trace.originExtract, null);
  assert.equal(trace.firstRecord, null);
  assert.equal(trace.originLag, null);
  assert.equal(trace.layers.length, 1);
  assert.equal(trace.layers[0]?.kind, "plug");
  assert.ok(trace.degraded.includes("wikipedia offline"));
});

test("wikiPagepropsUrl underscores spaces and asks for wikibase_item", () => {
  assert.equal(
    wikiPagepropsUrl("Camry"),
    "https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&titles=Camry&format=json&origin=*",
  );
  const camry = wikiPagepropsUrl("Toyota Camry");
  assert.equal(camry.includes("titles=Toyota_Camry"), true);
  assert.equal(camry.includes("%20"), false);
  assert.equal(wikiPagepropsUrl("C++").includes("titles=C%2B%2B"), true);
  assert.equal(camry.includes("ppprop=wikibase_item"), true);
});

test("wikidataEntityUrl encodes qid and asks for claims only", () => {
  assert.equal(
    wikidataEntityUrl("Q39973"),
    "https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q39973&props=claims&format=json&origin=*",
  );
  const spaced = wikidataEntityUrl("Q 39973");
  assert.equal(spaced.includes("ids=Q%2039973"), true);
  assert.equal(spaced.includes("props=claims"), true);
  assert.equal(spaced.includes("props=labels"), false);
});

test("usptoV2Url uses search.patentsview.org size=5 not legacy per_page", () => {
  const camry = usptoV2Url("Camry");
  assert.equal(
    camry,
    "https://search.patentsview.org/api/v1/patent/?q=%7B%22_text_any%22%3A%7B%22patent_title%22%3A%22Camry%22%7D%7D&f=[\"patent_id\",\"patent_title\",\"patent_date\",\"patent_abstract\"]&o={\"size\":5}",
  );
  const spaced = usptoV2Url("Toyota Camry");
  assert.equal(spaced.includes("Toyota%20Camry"), true);
  assert.equal(spaced.includes("search.patentsview.org"), true);
  assert.equal(spaced.includes("api.patentsview.org"), false);
  assert.equal(spaced.includes("\"size\":5"), true);
  assert.equal(spaced.includes("per_page"), false);
  assert.equal(spaced.includes("patent_number"), false);
});

test("pickFirstRecord does not let a newer grant beat an older wiki first-print", () => {
  const wiki = rec({
    title: "wiki 1983",
    url: "https://en.wikipedia.org/wiki/Toyota_Camry",
    source: "wikipedia",
    at: "1983-01-01T00:00:00Z",
  });
  const laterGrant = rec({
    title: "later Camry grant",
    url: "https://patents.google.com/patent/US9999999",
    source: "uspto",
    at: "1999-01-01T00:00:00Z",
  });
  const undatedGrant = rec({
    title: "undated Camry grant",
    url: "https://patents.google.com/patent/US1111111",
    source: "uspto",
    at: null,
  });
  assert.equal(pickFirstRecord(wiki, [laterGrant])?.source, "wikipedia");
  assert.equal(pickFirstRecord(wiki, [undatedGrant])?.source, "wikipedia");
  assert.equal(pickFirstRecord(null, [laterGrant])?.source, "uspto");
  assert.equal(pickFirstRecord(null, [undatedGrant]), null);
});

test("measureOriginLag leftover missing fields and one-year gap stay locked", () => {
  assert.equal(measureOriginLag(yearIso(1982), null, "https://www.wikidata.org/wiki/Q39973", "2004-06-20T00:00:00Z"), null);
  assert.equal(measureOriginLag(null, "wikidata", "https://www.wikidata.org/wiki/Q39973", "2004-06-20T00:00:00Z"), null);
  assert.equal(measureOriginLag(yearIso(1982), "wikidata", "https://www.wikidata.org/wiki/Q39973", "not-a-date"), null);
  assert.equal(measureOriginLag(yearIso(2003), "wikidata", "https://www.wikidata.org/wiki/Q39973", "2004-06-20T00:00:00Z")?.lagYears, 1);
});

test("assembleRoots leftover receipt dedup keeps same url when the stamp differs", () => {
  const first = rec({
    title: "Camry paper 0",
    url: "https://pubmed.example/0",
    source: "pubmed",
    at: "2000-01-01T00:00:00Z",
  });
  const dup = rec({
    title: "Camry paper 0 copy",
    url: "https://pubmed.example/0",
    source: "pubmed",
    at: "2000-01-01T00:00:00Z",
  });
  const laterSameUrl = rec({
    title: "Camry paper 0 later",
    url: "https://pubmed.example/0",
    source: "pubmed",
    at: "2001-01-01T00:00:00Z",
  });
  const trace = assembleRoots({
    query: "Camry",
    wiki: null,
    wikiRoot: null,
    abstract: null,
    dated: [first, dup, laterSameUrl],
    tape: [],
    ...emptyInception,
    degraded: [],
  });
  assert.equal(trace.receipts.length, 2);
  assert.deepEqual(
    trace.receipts.map((r) => r.at),
    ["2000-01-01T00:00:00Z", "2001-01-01T00:00:00Z"],
  );
});

test("assembleRoots leftover 16-cap keeps the oldest Camry rows", () => {
  const dated = Array.from({ length: 17 }, (_, i) =>
    rec({
      title: `Camry paper ${i}`,
      url: `https://pubmed.example/${i}`,
      source: "pubmed",
      at: `2000-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
    }),
  );
  const trace = assembleRoots({
    query: "Camry",
    wiki: null,
    wikiRoot: null,
    abstract: null,
    dated,
    tape: [],
    ...emptyInception,
    degraded: [],
  });
  assert.equal(trace.receipts.length, 16);
  assert.equal(trace.receipts[0]?.url, "https://pubmed.example/0");
  assert.equal(trace.receipts.some((r) => r.url === "https://pubmed.example/16"), false);
});

test("assembleRoots empty query does not keep Camry dated rows", () => {
  const trace = assembleRoots({
    query: "  ",
    wiki: null,
    wikiRoot: null,
    abstract: null,
    dated: [
      rec({
        title: "Camry hybrid recall",
        url: "https://pubmed.example/1",
        source: "pubmed",
        at: "2018-04-01T00:00:00Z",
      }),
    ],
    tape: [],
    ...emptyInception,
    degraded: [],
  });
  assert.equal(trace.receipts.length, 0);
  assert.equal(trace.firstRecord, null);
});

test("patentsFromLegacy prefixes US even when the number already has it", () => {
  const doubled = patentsFromLegacy({
    patents: [{ patent_number: "US4501234", patent_title: "Camry body" }],
  });
  assert.equal(doubled[0]?.url, "https://patents.google.com/patent/USUS4501234");
  assert.deepEqual(patentsFromLegacy({}), []);
  assert.deepEqual(patentsFromV2({}), []);
});
