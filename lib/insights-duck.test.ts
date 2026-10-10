import assert from "node:assert/strict";
import { test } from "node:test";
import { mapDuckAbstract } from "./insights-roots";

test("mapDuckAbstract needs Abstract+URL, uses query when Heading misses, and does not invent a page", () => {
  const hit = mapDuckAbstract(
    {
      Heading: "Toyota Camry",
      Abstract: "The Toyota Camry is a car.",
      AbstractURL: "https://en.wikipedia.org/wiki/Toyota_Camry",
    },
    "Camry",
  );
  assert.equal(hit?.title, "Toyota Camry");
  assert.equal(hit?.url, "https://en.wikipedia.org/wiki/Toyota_Camry");
  assert.equal(hit?.snippet, "The Toyota Camry is a car.");

  const noHeading = mapDuckAbstract(
    {
      Abstract: "A compact sedan.",
      AbstractURL: "https://en.wikipedia.org/wiki/Toyota_Camry",
    },
    "Camry",
  );
  assert.equal(noHeading?.title, "Camry");

  const long = mapDuckAbstract(
    {
      Heading: "C".repeat(200),
      Abstract: "S".repeat(600),
      AbstractURL: "https://en.wikipedia.org/wiki/Toyota_Camry",
    },
    "Camry",
  );
  assert.equal(long?.title.length, 160);
  assert.equal(long?.snippet.length, 480);

  assert.equal(mapDuckAbstract({ Abstract: "only text" }, "Camry"), null);
  assert.equal(mapDuckAbstract({ AbstractURL: "https://en.wikipedia.org/wiki/Ghost" }, "Camry"), null);
  assert.equal(mapDuckAbstract({ Heading: "Toyota Camry", Abstract: "", AbstractURL: "" }, "Camry"), null);
  assert.equal(mapDuckAbstract({}, "Camry"), null);
  assert.equal(mapDuckAbstract(null, "Camry"), null);
});
