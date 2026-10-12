import assert from "node:assert/strict";
import { test } from "node:test";
import { inceptionFromWikidataClaims, wikiRootFromQuery, yearIso } from "./insights-roots";

test("inceptionFromWikidataClaims prefers P571 over P580/P569, requires an object time value, and does not fall through on a bad lead claim", () => {
  assert.equal(
    inceptionFromWikidataClaims({
      P571: [{ mainsnak: { datavalue: { value: { time: "+1982-01-01T00:00:00Z" } } } }],
      P580: [{ mainsnak: { datavalue: { value: { time: "+1997-01-01T00:00:00Z" } } } }],
      P569: [{ mainsnak: { datavalue: { value: { time: "+2004-01-01T00:00:00Z" } } } }],
    }),
    yearIso(1982),
  );

  assert.equal(
    inceptionFromWikidataClaims({
      P580: [{ mainsnak: { datavalue: { value: { time: "+1997-06-01T00:00:00Z" } } } }],
    }),
    yearIso(1997),
  );

  assert.equal(
    inceptionFromWikidataClaims({
      P569: [{ mainsnak: { datavalue: { value: { time: "+2004-06-20T00:00:00Z" } } } }],
    }),
    yearIso(2004),
  );

  assert.equal(
    inceptionFromWikidataClaims({
      P571: [{ mainsnak: { datavalue: { value: "+1982-01-01T00:00:00Z" } } }],
      P580: [{ mainsnak: { datavalue: { value: { time: "+1997-01-01T00:00:00Z" } } } }],
    }),
    null,
  );

  assert.equal(
    inceptionFromWikidataClaims({
      P571: [{ mainsnak: { datavalue: { value: { time: "+1799-01-01T00:00:00Z" } } } }],
      P580: [{ mainsnak: { datavalue: { value: { time: "+1982-01-01T00:00:00Z" } } } }],
    }),
    null,
  );

  assert.equal(inceptionFromWikidataClaims({}), null);
  assert.equal(inceptionFromWikidataClaims(null), null);
  assert.equal(inceptionFromWikidataClaims([]), null);
});

test("wikiRootFromQuery reads the first revision, strips Category:, and drops housekeeping strata", () => {
  const root = wikiRootFromQuery(
    {
      query: {
        pages: {
          "123": {
            revisions: [{ timestamp: "2004-06-20T04:15:36Z", user: "editor" }],
          },
        },
      },
    },
    {
      query: {
        pages: {
          "123": {
            categories: [
              { title: "Category:Toyota vehicles" },
              { title: "Category:All stub articles" },
              { title: "CS1 errors" },
              { title: "Compact cars" },
              { title: "Wikipedia articles needing cleanup" },
            ],
          },
        },
      },
    },
  );
  assert.equal(root.firstAt, "2004-06-20T04:15:36Z");
  assert.equal(root.firstEditor, "editor");
  assert.deepEqual(root.parents, ["Toyota vehicles", "Compact cars"]);

  const emptyStamp = wikiRootFromQuery(
    { query: { pages: { "1": { revisions: [{ timestamp: "", user: "bot" }] } } } },
    { query: { pages: { "1": { categories: [{ title: "" }] } } } },
  );
  assert.equal(emptyStamp.firstAt, "");
  assert.equal(emptyStamp.firstEditor, "bot");
  assert.deepEqual(emptyStamp.parents, []);

  assert.deepEqual(wikiRootFromQuery(null, null), {
    firstAt: null,
    firstEditor: null,
    parents: [],
  });
  assert.deepEqual(wikiRootFromQuery({}, {}), {
    firstAt: null,
    firstEditor: null,
    parents: [],
  });
  assert.deepEqual(wikiRootFromQuery([], []), {
    firstAt: null,
    firstEditor: null,
    parents: [],
  });
});
