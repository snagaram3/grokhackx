import assert from "node:assert/strict";
import { test } from "node:test";
import { wikiPostsFromOpenSearch } from "./public-apis";

test("wikiPostsFromOpenSearch leftover keeps titled+URLed hits and drops title-only crumbs", () => {
  const posts = wikiPostsFromOpenSearch([
    "Camry",
    ["Toyota Camry", "Camryn Manheim", ""],
    ["car", "actor", "empty"],
    [
      "https://en.wikipedia.org/wiki/Toyota_Camry",
      "",
      "https://en.wikipedia.org/wiki/Camry",
    ],
  ]);
  assert.equal(posts.length, 1);
  assert.equal(posts[0]?.title, "Wikipedia: Toyota Camry");
  assert.equal(posts[0]?.url, "https://en.wikipedia.org/wiki/Toyota_Camry");
  assert.equal(posts[0]?.sourceApi, "Wikipedia");
  assert.equal(posts[0]?.tool, "collect_public_apis");
  assert.equal(posts[0]?.score, 80);
});

test("wikiPostsFromOpenSearch leftover junk and empty titles are an empty tape", () => {
  assert.deepEqual(wikiPostsFromOpenSearch(null), []);
  assert.deepEqual(wikiPostsFromOpenSearch({}), []);
  assert.deepEqual(wikiPostsFromOpenSearch(["Camry", [], [], []]), []);
  assert.deepEqual(
    wikiPostsFromOpenSearch(["Camry", ["Toyota Camry"], ["car"], []]),
    [],
  );
});
