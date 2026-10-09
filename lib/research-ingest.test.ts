import assert from "node:assert/strict";
import { test } from "node:test";
import { mapDuckDuckGo, mapPubMedSummary, mapWikipediaSources } from "./research";

test("mapDuckDuckGo keeps Abstract+URL Camry, drops crumbs, ignores nested Topics, caps 8", () => {
  const sources = mapDuckDuckGo(
    {
      Heading: "Toyota Camry",
      Abstract: "The Toyota Camry is a car.",
      AbstractURL: "https://en.wikipedia.org/wiki/Toyota_Camry",
      RelatedTopics: [
        { Text: "Camry Hybrid", FirstURL: "https://en.wikipedia.org/wiki/Toyota_Camry#Hybrid" },
        { Text: "no url" },
        { FirstURL: "https://duckduckgo.com/?q=ghost" },
        { Topics: [{ Text: "nested", FirstURL: "https://en.wikipedia.org/wiki/Ghost" }] },
        ...Array.from({ length: 10 }, (_, i) => ({
          Text: `extra ${i}`,
          FirstURL: `https://example.test/camry-${i}`,
        })),
      ],
    },
    "Camry",
  );
  assert.equal(sources.length, 8);
  assert.equal(sources[0].id, "web-1");
  assert.equal(sources[0].kind, "web");
  assert.equal(sources[0].title, "Toyota Camry");
  assert.equal(sources[0].url, "https://en.wikipedia.org/wiki/Toyota_Camry");
  assert.equal(sources[1].title, "Camry Hybrid");
  assert.equal(
    sources.some((s) => s.url.includes("ghost") || s.title === "nested"),
    false,
  );
  assert.deepEqual(
    mapDuckDuckGo({ Abstract: "text only" }, "Camry"),
    [],
  );
  assert.deepEqual(mapDuckDuckGo({ AbstractURL: "https://example.test" }, "Camry"), []);
  const fallback = mapDuckDuckGo(
    { Abstract: "A sedan.", AbstractURL: "https://en.wikipedia.org/wiki/Camry" },
    "Camry",
  );
  assert.equal(fallback[0].title, "Camry");
  assert.deepEqual(mapDuckDuckGo({}, "Camry"), []);
  assert.deepEqual(mapDuckDuckGo(null, "Camry"), []);
});

test("mapPubMedSummary keeps titled ids, skips uids arrays and missing titles, does not invent a paper", () => {
  const sources = mapPubMedSummary(["38879984", "1", "missing", "2"], {
    result: {
      uids: ["38879984", "1", "missing", "2"],
      "38879984": {
        title: "Apple MdZAT5 mediates root development under drought stress.",
        source: "Plant Physiol Biochem",
        sortpubdate: "2024/08/01 00:00",
      },
      "1": { source: "Ghost" },
      "2": { title: "Camry crash biomechanics", source: "Traffic Inj Prev", sortpubdate: "2019/01/01 00:00" },
    },
  });
  assert.equal(sources.length, 2);
  assert.equal(sources[0].id, "pubmed-1");
  assert.equal(sources[0].kind, "pubmed");
  assert.equal(sources[0].url, "https://pubmed.ncbi.nlm.nih.gov/38879984/");
  assert.equal(sources[0].createdAt, "2024/08/01 00:00");
  assert.match(sources[0].snippet, /Plant Physiol Biochem/);
  assert.equal(sources[1].id, "pubmed-2");
  assert.equal(sources[1].url, "https://pubmed.ncbi.nlm.nih.gov/2/");
  assert.deepEqual(mapPubMedSummary(["38879984"], {}), []);
  assert.deepEqual(mapPubMedSummary([], { result: { "1": { title: "x" } } }), []);
});

test("mapWikipediaSources drops the lead when summary is missing and never invents a WHY", () => {
  const searched = [
    "Camry",
    ["Toyota Camry", "Camry (disambiguation)", "Camryn Manheim", "Fourth extra", "Fifth extra"],
    ["", "", "", "", ""],
    [
      "https://en.wikipedia.org/wiki/Toyota_Camry",
      "",
      "https://en.wikipedia.org/wiki/Camryn_Manheim",
      "https://en.wikipedia.org/wiki/Fourth",
      "https://en.wikipedia.org/wiki/Fifth",
    ],
  ];
  const withSummary = mapWikipediaSources(searched, {
    title: "Toyota Camry",
    extract: "The Toyota Camry is an automobile.",
    content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Toyota_Camry" } },
  });
  assert.equal(withSummary.length, 4);
  assert.equal(withSummary[0].id, "wikipedia-1");
  assert.equal(withSummary[0].title, "Toyota Camry");
  assert.equal(withSummary[1].id, "wikipedia-2");
  assert.equal(withSummary[1].url, "https://en.wikipedia.org/wiki/Camry_(disambiguation)");
  assert.equal(withSummary[1].snippet, "Wikipedia page: Camry (disambiguation)");
  assert.equal(withSummary[2].url, "https://en.wikipedia.org/wiki/Camryn_Manheim");
  assert.equal(
    withSummary.some((s) => s.url.includes("Fifth")),
    false,
  );

  const noSummary = mapWikipediaSources(searched, null);
  assert.equal(noSummary.length, 3);
  assert.equal(noSummary[0].id, "wikipedia-2");
  assert.equal(
    noSummary.some((s) => s.id === "wikipedia-1"),
    false,
  );

  const noUrl = mapWikipediaSources(["Camry", ["Toyota Camry"], [], []], {
    extract: "",
  });
  assert.equal(noUrl[0].url, "https://en.wikipedia.org/wiki/Toyota_Camry");
  assert.equal(noUrl[0].title, "Toyota Camry");
  assert.equal(noUrl[0].snippet, "");

  assert.deepEqual(mapWikipediaSources(["Camry", [], [], []], { title: "x" }), []);
  assert.deepEqual(mapWikipediaSources({}, { title: "Toyota Camry" }), []);
});
