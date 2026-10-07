import assert from "node:assert/strict";
import { test } from "node:test";
import { wikiPostsFromPageviews } from "./public-apis";

test("wikiPostsFromPageviews keeps titled articles and drops Special/Main/Wiki/Portal/File crumbs", () => {
  const posts = wikiPostsFromPageviews({
    items: [
      {
        articles: [
          { article: "Toyota_Camry", views: 10_000 },
          { article: "Special:Search", views: 99_999 },
          { article: "Main_Page", views: 80_000 },
          { article: "Wikipedia", views: 50_000 },
          { article: "Portal:Current_events", views: 12_000 },
          { article: "File:Camry.jpg", views: 9_000 },
          { article: "", views: 8_000 },
        ],
      },
    ],
  });
  assert.equal(posts.length, 1);
  assert.equal(posts[0]?.title, "Wikipedia: Toyota Camry");
  assert.equal(posts[0]?.url, "https://en.wikipedia.org/wiki/Toyota_Camry");
  assert.equal(posts[0]?.sourceApi, "Wikipedia");
  assert.equal(posts[0]?.tool, "collect_public_apis");
  assert.ok((posts[0]?.score ?? 0) >= 1);
});

test("wikiPostsFromPageviews returns empty on junk and caps at eight articles", () => {
  assert.deepEqual(wikiPostsFromPageviews(null), []);
  assert.deepEqual(wikiPostsFromPageviews({}), []);
  assert.deepEqual(wikiPostsFromPageviews({ items: { articles: [{ article: "Camry" }] } }), []);

  const many = wikiPostsFromPageviews({
    items: [
      {
        articles: Array.from({ length: 12 }, (_, i) => ({
          article: `Camry_model_${i}`,
          views: 100 + i,
        })),
      },
    ],
  });
  assert.equal(many.length, 8);
  assert.equal(many[0]?.title, "Wikipedia: Camry model 0");
  assert.equal(many[7]?.title, "Wikipedia: Camry model 7");
});
