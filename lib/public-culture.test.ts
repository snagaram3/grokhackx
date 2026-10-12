import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mapCheapSharkDeals,
  mapItunesCharts,
  mapItunesSearch,
  mapJikanAnime,
  mapMastodonTags,
  mapOpenFoodFacts,
} from "./public-apis";

test("mapItunesSearch prefers trackName, concatenates artist, and falls back to music.apple.com when both URLs miss", () => {
  const posts = mapItunesSearch({
    results: [
      {
        trackName: "Camry Nights",
        collectionName: "Ignored Album",
        artistName: "Toyota",
        trackViewUrl: "https://music.apple.com/track/1",
        collectionViewUrl: "https://music.apple.com/album/ghost",
      },
      { collectionName: "No Track EP", artistName: "Dealer" },
      { trackName: "Instrumental" },
      { artistName: "nameless" },
    ],
  });
  assert.equal(posts.length, 3);
  assert.equal(posts[0].sourceApi, "iTunes");
  assert.equal(posts[0].tool, "collect_public_apis");
  assert.equal(posts[0].title, "Camry Nights — Toyota");
  assert.equal(posts[0].url, "https://music.apple.com/track/1");
  assert.equal(posts[0].score, 55);
  assert.equal(posts[1].title, "No Track EP — Dealer");
  assert.equal(posts[1].url, "https://music.apple.com/");
  assert.equal(posts[2].title, "Instrumental");
  assert.equal(posts[2].url, "https://music.apple.com/");
  assert.deepEqual(mapItunesSearch({ results: [{}] }), []);
  assert.deepEqual(mapItunesSearch({}), []);
  assert.deepEqual(mapItunesSearch(null), []);
});

test("mapItunesCharts always interpolates artist (even when empty) and caps 8 after filter", () => {
  const posts = mapItunesCharts({
    feed: {
      results: [
        ...Array.from({ length: 8 }, () => ({ artistName: "ghost" })),
        { name: "Heat Wave", artistName: "Camry Band", url: "https://music.apple.com/heat" },
        { name: "No Artist Cut" },
      ],
    },
  });
  assert.equal(posts.length, 2);
  assert.equal(posts[0].title, "Heat Wave — Camry Band");
  assert.equal(posts[0].url, "https://music.apple.com/heat");
  assert.equal(posts[0].score, 48);
  assert.equal(posts[0].sourceApi, "iTunes");
  assert.equal(posts[1].title, "No Artist Cut — ");
  assert.equal(posts[1].url, "https://music.apple.com/");
  assert.deepEqual(mapItunesCharts({ feed: { results: [{}] } }), []);
  assert.deepEqual(mapItunesCharts({}), []);
});

test("mapJikanAnime falls back to myanimelist.net, caps score at 95, and drops untitled rows", () => {
  const posts = mapJikanAnime({
    data: [
      { title: "Camry Drift", url: "https://myanimelist.net/anime/1", score: 8.4 },
      { title: "No Url Arc", score: 9.6 },
      { url: "https://myanimelist.net/anime/ghost", score: 9 },
    ],
  });
  assert.equal(posts.length, 2);
  assert.equal(posts[0].title, "Camry Drift");
  assert.equal(posts[0].url, "https://myanimelist.net/anime/1");
  assert.equal(posts[0].score, 84);
  assert.equal(posts[0].sourceApi, "Jikan");
  assert.equal(posts[1].title, "No Url Arc");
  assert.equal(posts[1].url, "https://myanimelist.net/");
  assert.equal(posts[1].score, 95);
  assert.deepEqual(mapJikanAnime({ data: [{}] }), []);
  assert.deepEqual(mapJikanAnime({}), []);
  assert.deepEqual(mapJikanAnime(null), []);
});

test("mapMastodonTags strips one leading #, encodes the raw name in the URL, and sums history uses", () => {
  const posts = mapMastodonTags([
    { name: "heatwave", history: [{ uses: "9" }, { uses: 0 }] },
    { name: "#Camry", history: [] },
    { history: [{ uses: 99 }] },
  ]);
  assert.equal(posts.length, 2);
  assert.equal(posts[0].title, "#heatwave");
  assert.equal(posts[0].url, "https://mastodon.social/tags/heatwave");
  assert.equal(posts[0].score, 22);
  assert.equal(posts[0].sourceApi, "Mastodon");
  assert.equal(posts[1].title, "#Camry");
  assert.equal(posts[1].url, "https://mastodon.social/tags/%23Camry");
  assert.equal(posts[1].score, 1);
  assert.deepEqual(mapMastodonTags([{}]), []);
  assert.deepEqual(mapMastodonTags({}), []);
  assert.deepEqual(mapMastodonTags(null), []);
});

test("mapCheapSharkDeals uses a unicode minus, falls back to cheapshark.com when dealID misses, and caps savings score at 90", () => {
  const posts = mapCheapSharkDeals([
    { title: "Camry Simulator", savings: 12.6, dealID: "abc" },
    { title: "No Id Steam Cut", savings: 95.4 },
    { savings: 50, dealID: "ghost" },
  ]);
  assert.equal(posts.length, 2);
  assert.equal(posts[0].title, "Camry Simulator −13%");
  assert.equal(posts[0].url, "https://www.cheapshark.com/redirect?dealID=abc");
  assert.equal(posts[0].score, 13);
  assert.equal(posts[0].sourceApi, "CheapShark");
  assert.equal(posts[1].title, "No Id Steam Cut −95%");
  assert.equal(posts[1].url, "https://www.cheapshark.com/");
  assert.equal(posts[1].score, 90);
  assert.deepEqual(mapCheapSharkDeals([{}]), []);
  assert.deepEqual(mapCheapSharkDeals({}), []);
  assert.deepEqual(mapCheapSharkDeals(null), []);
});

test("mapOpenFoodFacts invents a product URL from the barcode when url misses, and untitled rows drop", () => {
  const posts = mapOpenFoodFacts({
    products: [
      {
        product_name: "Camry Cola",
        url: "https://world.openfoodfacts.org/product/123",
        unique_scans_n: 4000,
      },
      { product_name: "No Url Bar", code: "301", unique_scans_n: 0 },
      { code: "ghost", unique_scans_n: 99 },
    ],
  });
  assert.equal(posts.length, 2);
  assert.equal(posts[0].title, "Camry Cola");
  assert.equal(posts[0].url, "https://world.openfoodfacts.org/product/123");
  assert.equal(posts[0].score, 80);
  assert.equal(posts[0].sourceApi, "Open Food Facts");
  assert.equal(posts[1].title, "No Url Bar");
  assert.equal(posts[1].url, "https://world.openfoodfacts.org/product/301");
  assert.equal(posts[1].score, 1);
  assert.equal(
    posts.some((p) => p.url.includes("ghost")),
    false,
  );
  assert.deepEqual(mapOpenFoodFacts({ products: [{}] }), []);
  assert.deepEqual(mapOpenFoodFacts({}), []);
  assert.deepEqual(mapOpenFoodFacts(null), []);
});
