import assert from "node:assert/strict";
import { test } from "node:test";
import { pubmedReceiptsFromSummary } from "./insights-roots";

test("pubmedReceiptsFromSummary stamps pubmed URLs and turns the first space into T, never invents a paper", () => {
  const rows = pubmedReceiptsFromSummary(["38879984", "uids", "blank", "2"], {
    result: {
      uids: ["38879984", "blank", "2"],
      "38879984": {
        title: "Apple MdZAT5 mediates root development under drought stress.",
        source: "Plant Physiol Biochem",
        sortpubdate: "2024/08/01 00:00",
      },
      blank: { source: "Ghost Journal" },
      "2": { title: "Camry crash biomechanics" },
    },
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].source, "pubmed");
  assert.equal(rows[0].url, "https://pubmed.ncbi.nlm.nih.gov/38879984/");
  assert.equal(rows[0].at, "2024/08/01T00:00");
  assert.equal(rows[0].snippet, "Plant Physiol Biochem · 2024/08/01 00:00");
  assert.equal(rows[1].url, "https://pubmed.ncbi.nlm.nih.gov/2/");
  assert.equal(rows[1].at, null);
  assert.equal(rows[1].snippet, "");
  assert.deepEqual(pubmedReceiptsFromSummary(["1"], {}), []);
  assert.deepEqual(pubmedReceiptsFromSummary(["1"], { result: { "1": { title: "" } } }), []);
});
