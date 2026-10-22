import assert from "node:assert/strict";
import { test } from "node:test";
import { hnSearchUrl } from "./hn";

test("hnSearchUrl encodes q as Algolia story search at hitsPerPage", () => {
  assert.equal(
    hnSearchUrl("Camry"),
    "https://hn.algolia.com/api/v1/search?query=Camry&tags=story&hitsPerPage=20",
  );
  assert.equal(
    hnSearchUrl("Toyota Camry"),
    "https://hn.algolia.com/api/v1/search?query=Toyota%20Camry&tags=story&hitsPerPage=20",
  );
  assert.equal(hnSearchUrl("Camry", 12).includes("hitsPerPage=12"), true);
  const empty = hnSearchUrl("");
  assert.equal(
    empty,
    "https://hn.algolia.com/api/v1/search?query=&tags=story&hitsPerPage=20",
  );
  assert.equal(empty.includes("tags=front_page"), false);
  assert.equal(empty.includes("hitsPerPage=8"), false);
});
