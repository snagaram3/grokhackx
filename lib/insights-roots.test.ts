import assert from "node:assert/strict";
import { test } from "node:test";
import { mergePatents } from "./insights-store";
import {
  assembleRoots,
  extractBirthYear,
  hnTapeFromPosts,
  inceptionFromParents,
  keepCategory,
  measureOriginLag,
  oldestReceipt,
  patentsFromLegacy,
  patentsFromV2,
  pickFirstRecord,
  pickSenseTitle,
  resolveInception,
  wikiPageFromSummary,
  wikiSensesFromOpenSearch,
  wikidataTime,
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

test("wikiSensesFromOpenSearch invents a wiki slug and does not drop a title-only hit", () => {
  const senses = wikiSensesFromOpenSearch(
    ["Camry", "Toyota Camry", "C++", "Camryn Manheim", "sixth", "dropped"],
    ["https://en.wikipedia.org/wiki/Camry"],
  );
  assert.equal(senses.length, 5);
  assert.equal(senses[0]?.url, "https://en.wikipedia.org/wiki/Camry");
  assert.equal(senses[1]?.url, "https://en.wikipedia.org/wiki/Toyota_Camry");
  assert.equal(senses[1]?.url.includes("%20"), false);
  assert.equal(senses[2]?.url, "https://en.wikipedia.org/wiki/C%2B%2B");
  assert.equal(senses.some((s) => s.title === "dropped"), false);
  assert.deepEqual(wikiSensesFromOpenSearch(undefined, undefined), []);
  assert.deepEqual(wikiSensesFromOpenSearch([], ["https://en.wikipedia.org/wiki/Camry"]), []);
});

test("wikiPageFromSummary keeps the chosen page when summary is missing and does not invent WHY", () => {
  const chosen = { title: "Toyota Camry", url: "https://en.wikipedia.org/wiki/Toyota_Camry" };
  const senses = [chosen];
  const offline = wikiPageFromSummary(chosen, null, senses);
  assert.equal(offline.title, "Toyota Camry");
  assert.equal(offline.url, chosen.url);
  assert.equal(offline.extract, "");
  assert.equal(offline.senses, senses);

  const empty = wikiPageFromSummary(chosen, {}, senses);
  assert.equal(empty.title, "Toyota Camry");
  assert.equal(empty.extract, "");
  assert.equal(empty.url, chosen.url);

  const long = "The Toyota Camry is an automobile. ".repeat(40);
  const live = wikiPageFromSummary(
    chosen,
    {
      title: "Toyota Camry",
      extract: long,
      content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Toyota_Camry" } },
    },
    senses,
  );
  assert.equal(live.extract.length, 720);
  assert.equal(live.url, "https://en.wikipedia.org/wiki/Toyota_Camry");
});

test("hnTapeFromPosts caps 12 and keeps createdAt without inventing a story URL", () => {
  const posts = Array.from({ length: 13 }, (_, i) => ({
    title: `Camry thread ${i} ${"x".repeat(300)}`,
    url: `https://news.ycombinator.com/item?id=${i}`,
    createdAt: i === 0 ? "2018-04-01T00:00:00.000Z" : undefined,
  }));
  const tape = hnTapeFromPosts(posts);
  assert.equal(tape.length, 12);
  assert.equal(tape[0]?.source, "hn");
  assert.equal(tape[0]?.at, "2018-04-01T00:00:00.000Z");
  assert.equal(tape[1]?.at, null);
  assert.equal(tape[0]?.title.length, 200);
  assert.equal(tape[0]?.snippet.length, 280);
  assert.equal(tape.some((r) => r.url.includes("item?id=12")), false);
  assert.deepEqual(hnTapeFromPosts([]), []);
});

test("keepCategory leftover housekeeping prefixes stay dropped", () => {
  assert.equal(keepCategory("Articles for deletion"), false);
  assert.equal(keepCategory("Pages with broken file links"), false);
  assert.equal(keepCategory("Use dmy dates"), false);
  assert.equal(keepCategory("Use mdy dates"), false);
  assert.equal(keepCategory("Short description is different"), false);
  assert.equal(keepCategory("Webarchive template wayback"), false);
  assert.equal(keepCategory("Good articles"), false);
  assert.equal(keepCategory("Featured articles"), false);
  assert.equal(keepCategory("Toyota vehicles"), true);
});

test("extractBirthYear leftover first-introduced and 1800/2099 year capture stay locked", () => {
  assert.equal(extractBirthYear("The Camry was first introduced in 1982."), 1982);
  assert.equal(extractBirthYear("The plant was founded in 1800."), 1800);
  assert.equal(extractBirthYear("The line was founded in 2099."), 2099);
  assert.equal(extractBirthYear("The line was founded in 2100."), null);
  assert.equal(extractBirthYear("The line was founded in 1799."), null);
});

test("patentsFromLegacy and patentsFromV2 leftover missing abstract uses USPTO id", () => {
  const legacy = patentsFromLegacy({
    patents: [{ patent_number: "4501234", patent_title: "Camry body" }],
  });
  assert.equal(legacy[0]?.snippet, "USPTO 4501234");
  assert.equal(legacy[0]?.at, null);

  const v2 = patentsFromV2({
    patents: [{ patent_id: "US4501234", patent_title: "Camry body structure" }],
  });
  assert.equal(v2[0]?.snippet, "USPTO US4501234");
  assert.equal(v2[0]?.at, null);
});

test("assembleRoots leftover wikiBirth without an editor does not invent a byline", () => {
  const noEditor = assembleRoots({
    query: "Camry",
    wiki: {
      title: "Toyota Camry",
      url: "https://en.wikipedia.org/wiki/Toyota_Camry",
      extract: "The Toyota Camry is an automobile sold internationally by Toyota since 1982.",
      senses: [{ title: "Toyota Camry", url: "https://en.wikipedia.org/wiki/Toyota_Camry" }],
    },
    wikiRoot: { firstAt: "2003-02-01T00:00:00Z", firstEditor: null, parents: [] },
    abstract: null,
    dated: [],
    tape: [],
    ...emptyInception,
    degraded: [],
  });
  assert.equal(
    noEditor.receipts.find((r) => r.source === "wikipedia")?.snippet,
    "First Wikipedia revision",
  );
  assert.equal((noEditor.receipts.find((r) => r.source === "wikipedia")?.snippet ?? "").includes(" by "), false);
});

test("assembleRoots leftover origin without a url keeps the extract and omits a receipt", () => {
  const trace = assembleRoots({
    query: "Camry",
    wiki: {
      title: "Toyota Camry",
      url: "",
      extract: "The Toyota Camry is an automobile sold internationally by Toyota since 1982.",
      senses: [{ title: "Toyota Camry", url: "https://en.wikipedia.org/wiki/Toyota_Camry" }],
    },
    wikiRoot: null,
    abstract: null,
    dated: [],
    tape: [],
    ...emptyInception,
    degraded: [],
  });
  const origin = trace.layers.find((l) => l.kind === "origin");
  assert.equal(trace.thin, false);
  assert.match(trace.originExtract ?? "", /automobile/);
  assert.equal(trace.originUrl, null);
  assert.equal(origin?.receipt, undefined);
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
