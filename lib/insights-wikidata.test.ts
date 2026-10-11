import assert from "node:assert/strict";
import { test } from "node:test";
import { patentsFromWikidataClaims } from "./insights-roots";

test("patentsFromWikidataClaims keeps P1246 strings of length ≥4, strips spaces, and does not invent a grant date", () => {
  const rows = patentsFromWikidataClaims("Toyota Camry", {
    P1246: [
      { mainsnak: { datavalue: { value: "US 4501234" } } },
      { mainsnak: { datavalue: { value: "AB" } } },
      { mainsnak: { datavalue: { value: 4501234 } } },
      { mainsnak: { datavalue: { value: "   " } } },
      { mainsnak: { datavalue: { value: "EP0123456" } } },
    ],
    P571: [{ mainsnak: { datavalue: { value: { time: "+1982-01-01T00:00:00Z" } } } }],
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].title, "Toyota Camry · USPTO US4501234");
  assert.equal(rows[0].url, "https://patents.google.com/patent/US4501234");
  assert.equal(rows[0].source, "uspto");
  assert.equal(rows[0].at, null);
  assert.equal(rows[0].snippet, "Wikidata patent US4501234");
  assert.equal(rows[1].title, "Toyota Camry · USPTO EP0123456");
  assert.equal(rows[1].url, "https://patents.google.com/patent/EP0123456");
  assert.deepEqual(patentsFromWikidataClaims("Camry", {}), []);
  assert.deepEqual(patentsFromWikidataClaims("Camry", null), []);
  assert.deepEqual(patentsFromWikidataClaims("Camry", []), []);
});
