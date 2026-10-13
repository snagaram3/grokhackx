import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mapCryptoCompareNews,
  mapOpenAlex,
  mapSpaceflightNews,
  mapStackOverflow,
} from "./public-apis";

test("mapSpaceflightNews needs title and url, keeps published_at, and does not invent a href", () => {
  const posts = mapSpaceflightNews({
    results: [
      {
        title: "Camry rideshare to ISS",
        url: "https://spaceflightnewsapi.net/article/camry",
        published_at: "2026-10-13T08:00:00Z",
      },
      { title: "No Url Launch", published_at: "2026-10-12T00:00:00Z" },
      { url: "https://spaceflightnewsapi.net/article/ghost" },
      ...Array.from({ length: 8 }, () => ({})),
      { title: "Ninth titled", url: "https://spaceflightnewsapi.net/article/ninth" },
    ],
  });
  assert.equal(posts.length, 2);
  assert.equal(posts[0].sourceApi, "Spaceflight News");
  assert.equal(posts[0].tool, "collect_public_apis");
  assert.equal(posts[0].title, "Camry rideshare to ISS");
  assert.equal(posts[0].url, "https://spaceflightnewsapi.net/article/camry");
  assert.equal(posts[0].score, 60);
  assert.equal(posts[0].createdAt, "2026-10-13T08:00:00Z");
  assert.equal(posts[1].title, "Ninth titled");
  assert.equal(
    posts.some((p) => p.title.includes("No Url") || p.url.includes("ghost")),
    false,
  );
  assert.deepEqual(mapSpaceflightNews({ results: [{}] }), []);
  assert.deepEqual(mapSpaceflightNews({}), []);
  assert.deepEqual(mapSpaceflightNews(null), []);
});

test("mapStackOverflow falls back to stackoverflow.com/, adds 20 to score, and does not cap after filter", () => {
  const posts = mapStackOverflow({
    items: [
      {
        title: "Camry OBD-II in Node",
        link: "https://stackoverflow.com/q/1",
        score: 5,
      },
      { title: "No Link Question", score: 0 },
      { link: "https://stackoverflow.com/q/ghost" },
    ],
  });
  assert.equal(posts.length, 2);
  assert.equal(posts[0].sourceApi, "Stack Overflow");
  assert.equal(posts[0].title, "Camry OBD-II in Node");
  assert.equal(posts[0].url, "https://stackoverflow.com/q/1");
  assert.equal(posts[0].score, 25);
  assert.equal(posts[1].title, "No Link Question");
  assert.equal(posts[1].url, "https://stackoverflow.com/");
  assert.equal(posts[1].score, 20);
  assert.deepEqual(mapStackOverflow({ items: [{}] }), []);
  assert.deepEqual(mapStackOverflow({}), []);
  assert.deepEqual(mapStackOverflow(null), []);
});

test("mapOpenAlex uses display_name, empty id falls back to openalex.org/, and junk is []", () => {
  const posts = mapOpenAlex({
    results: [
      { display_name: "Camry crash kinematics", id: "https://openalex.org/W123" },
      { display_name: "No Id Paper" },
      { id: "https://openalex.org/Wghost" },
    ],
  });
  assert.equal(posts.length, 2);
  assert.equal(posts[0].sourceApi, "OpenAlex");
  assert.equal(posts[0].title, "Camry crash kinematics");
  assert.equal(posts[0].url, "https://openalex.org/W123");
  assert.equal(posts[0].score, 55);
  assert.equal(posts[1].title, "No Id Paper");
  assert.equal(posts[1].url, "https://openalex.org/");
  assert.deepEqual(mapOpenAlex({ results: [{}] }), []);
  assert.deepEqual(mapOpenAlex({}), []);
  assert.deepEqual(mapOpenAlex(null), []);
});

test("mapCryptoCompareNews slices raw Data to 8 before dropping empties, unix published_on becomes ISO, missing url uses news/", () => {
  const posts = mapCryptoCompareNews({
    Data: [
      {
        title: "BTC funding",
        url: "https://www.cryptocompare.com/news/btc",
        published_on: 1_770_000_000,
      },
      { title: "No Url Coin" },
      ...Array.from({ length: 8 }, () => ({})),
      { title: "Camry token", url: "https://www.cryptocompare.com/news/camry" },
    ],
  });
  assert.equal(posts.length, 2);
  assert.equal(posts[0].sourceApi, "CryptoCompare");
  assert.equal(posts[0].title, "BTC funding");
  assert.equal(posts[0].url, "https://www.cryptocompare.com/news/btc");
  assert.equal(posts[0].score, 52);
  assert.equal(posts[0].createdAt, new Date(1_770_000_000 * 1000).toISOString());
  assert.equal(posts[1].title, "No Url Coin");
  assert.equal(posts[1].url, "https://www.cryptocompare.com/news/");
  assert.equal(
    posts.some((p) => p.title.includes("Camry")),
    false,
  );
  assert.deepEqual(mapCryptoCompareNews({ Data: [{}] }), []);
  assert.deepEqual(mapCryptoCompareNews({}), []);
  assert.deepEqual(mapCryptoCompareNews(null), []);
});
