import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mapDevToArticles,
  mapLobsters,
  mapOpenLibraryDocs,
  mapOpenLibraryTrending,
  mapTvMazeSchedule,
  mapTvMazeSearch,
} from "./public-apis";

test("mapTvMazeSearch falls back to tvmaze.com/, scores from the raw index, and slices after filter", () => {
  const posts = mapTvMazeSearch([
    ...Array.from({ length: 8 }, () => ({ show: { url: "https://www.tvmaze.com/shows/0" } })),
    {
      show: {
        name: "Camry Night",
        url: "https://www.tvmaze.com/shows/91/camry-night",
      },
    },
    { show: { name: "No Url Sitcom" } },
  ]);
  assert.equal(posts.length, 2);
  assert.equal(posts[0].sourceApi, "TVMaze");
  assert.equal(posts[0].tool, "collect_public_apis");
  assert.equal(posts[0].title, "Camry Night");
  assert.equal(posts[0].url, "https://www.tvmaze.com/shows/91/camry-night");
  assert.equal(posts[0].score, 48);
  assert.equal(posts[1].title, "No Url Sitcom");
  assert.equal(posts[1].url, "https://www.tvmaze.com/");
  assert.deepEqual(mapTvMazeSearch([{ show: {} }]), []);
  assert.deepEqual(mapTvMazeSearch({}), []);
  assert.deepEqual(mapTvMazeSearch(null), []);
});

test("mapTvMazeSchedule uses _embedded.show, concatenates episode names, and drops untitled shows", () => {
  const posts = mapTvMazeSchedule([
    {
      name: "Pilot",
      airdate: "2026-10-13",
      show: { name: "Camry Files", url: "https://www.tvmaze.com/shows/1/camry-files" },
    },
    {
      name: "",
      _embedded: { show: { name: "No Url Drama" } },
    },
    { name: "Ghost", show: { url: "https://www.tvmaze.com/shows/9" } },
  ]);
  assert.equal(posts.length, 2);
  assert.equal(posts[0].title, "Camry Files: Pilot");
  assert.equal(posts[0].url, "https://www.tvmaze.com/shows/1/camry-files");
  assert.equal(posts[0].createdAt, "2026-10-13");
  assert.equal(posts[0].score, 45);
  assert.equal(posts[1].title, "No Url Drama");
  assert.equal(posts[1].url, "https://www.tvmaze.com/");
  assert.equal(
    posts.some((p) => p.title.includes("Ghost")),
    false,
  );
  assert.deepEqual(mapTvMazeSchedule([{}]), []);
  assert.deepEqual(mapTvMazeSchedule(null), []);
});

test("mapOpenLibraryDocs uses the work key, falls back to openlibrary.org/, and does not cap after filter", () => {
  const posts = mapOpenLibraryDocs({
    docs: [
      { title: "The Camry Book", key: "/works/OL1W" },
      { title: "Untitled Key Miss" },
      { key: "/works/OL9W" },
    ],
  });
  assert.equal(posts.length, 2);
  assert.equal(posts[0].sourceApi, "Open Library");
  assert.equal(posts[0].title, "The Camry Book");
  assert.equal(posts[0].url, "https://openlibrary.org/works/OL1W");
  assert.equal(posts[0].score, 60);
  assert.equal(posts[1].title, "Untitled Key Miss");
  assert.equal(posts[1].url, "https://openlibrary.org/");
  const fallback = mapOpenLibraryDocs({ docs: [{ title: "English", key: "/works/OL2W" }] }, 50);
  assert.equal(fallback[0].score, 50);
  assert.deepEqual(mapOpenLibraryDocs({ docs: [{}] }), []);
  assert.deepEqual(mapOpenLibraryDocs({}), []);
  assert.deepEqual(mapOpenLibraryDocs(null), []);
});

test("mapOpenLibraryTrending logged_edition 0 falls back to 50, missing key uses /, and caps 8 after filter", () => {
  const posts = mapOpenLibraryTrending({
    works: [
      ...Array.from({ length: 8 }, () => ({ key: "/works/OL0W" })),
      { title: "Camry Manual", key: "/works/OL3W", logged_edition: 200 },
      { title: "Zero Editions", logged_edition: 0 },
    ],
  });
  assert.equal(posts.length, 2);
  assert.equal(posts[0].title, "Camry Manual");
  assert.equal(posts[0].url, "https://openlibrary.org/works/OL3W");
  assert.equal(posts[0].score, 90);
  assert.equal(posts[1].title, "Zero Editions");
  assert.equal(posts[1].url, "https://openlibrary.org/");
  assert.equal(posts[1].score, 50);
  assert.deepEqual(mapOpenLibraryTrending({ works: [{}] }), []);
  assert.deepEqual(mapOpenLibraryTrending({}), []);
  assert.deepEqual(mapOpenLibraryTrending(null), []);
});

test("mapDevToArticles needs title and url, does not invent a href, and caps 8 after filter", () => {
  const posts = mapDevToArticles([
    ...Array.from({ length: 8 }, () => ({ title: "", url: "https://dev.to/ghost" })),
    {
      title: "Camry telemetry in Node",
      url: "https://dev.to/hawk/camry-telemetry",
      positive_reactions_count: 12,
    },
    { title: "No Url Post", positive_reactions_count: 99 },
  ]);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].sourceApi, "Dev.to");
  assert.equal(posts[0].title, "Camry telemetry in Node");
  assert.equal(posts[0].url, "https://dev.to/hawk/camry-telemetry");
  assert.equal(posts[0].score, 12);
  assert.equal(
    posts.some((p) => p.title.includes("No Url") || p.url.includes("ghost")),
    false,
  );
  assert.deepEqual(mapDevToArticles([{ title: "x" }]), []);
  assert.deepEqual(mapDevToArticles({}), []);
  assert.deepEqual(mapDevToArticles(null), []);
});

test("mapLobsters needs title and url, score*4 caps 100, and zero score still stamps 1", () => {
  const posts = mapLobsters([
    { title: "Camry recall thread", url: "https://lobste.rs/s/camry", score: 30 },
    { title: "Quiet", url: "https://lobste.rs/s/quiet", score: 0 },
    { title: "No Url" },
    { url: "https://lobste.rs/s/ghost" },
  ]);
  assert.equal(posts.length, 2);
  assert.equal(posts[0].sourceApi, "Lobsters");
  assert.equal(posts[0].title, "Camry recall thread");
  assert.equal(posts[0].url, "https://lobste.rs/s/camry");
  assert.equal(posts[0].score, 100);
  assert.equal(posts[1].title, "Quiet");
  assert.equal(posts[1].score, 1);
  assert.deepEqual(mapLobsters([{}]), []);
  assert.deepEqual(mapLobsters({}), []);
  assert.deepEqual(mapLobsters(null), []);
});
