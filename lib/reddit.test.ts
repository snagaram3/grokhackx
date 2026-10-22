import assert from "node:assert/strict";
import { test } from "node:test";
import { redditSearchUrl } from "./reddit";

test("redditSearchUrl encodes q at sort=hot limit=25", () => {
  assert.equal(
    redditSearchUrl("Camry"),
    "https://www.reddit.com/search.json?q=Camry&sort=hot&limit=25&raw_json=1",
  );
  assert.equal(
    redditSearchUrl("Toyota Camry"),
    "https://www.reddit.com/search.json?q=Toyota%20Camry&sort=hot&limit=25&raw_json=1",
  );
  const empty = redditSearchUrl("");
  assert.equal(
    empty,
    "https://www.reddit.com/search.json?q=&sort=hot&limit=25&raw_json=1",
  );
  assert.equal(empty.includes("sort=new"), false);
  assert.equal(empty.includes("sort=top"), false);
  assert.equal(empty.includes("limit=50"), false);
});
