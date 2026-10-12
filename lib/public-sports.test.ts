import assert from "node:assert/strict";
import { test } from "node:test";
import { mapEspnScoreboard, mapSportsDbPast, mapSportsDbSearch } from "./public-apis";

test("mapSportsDbSearch prefers event over events, invents an event URL when id misses, and drops untitled rows", () => {
  const posts = mapSportsDbSearch({
    event: [
      { strEvent: "Camry Cup Final", idEvent: "1234", dateEvent: "2026-10-12" },
      { strEvent: "No Id Derby", dateEvent: "2026-10-13" },
      { idEvent: "ghost", dateEvent: "2026-10-14" },
    ],
    events: [{ strEvent: "World Cup leftover", idEvent: "9999" }],
  });
  assert.equal(posts.length, 2);
  assert.equal(posts[0].sourceApi, "TheSportsDB");
  assert.equal(posts[0].tool, "collect_public_apis");
  assert.equal(posts[0].title, "Camry Cup Final");
  assert.equal(posts[0].url, "https://www.thesportsdb.com/event/1234");
  assert.equal(posts[0].score, 70);
  assert.equal(posts[0].createdAt, "2026-10-12");
  assert.equal(posts[1].title, "No Id Derby");
  assert.equal(posts[1].url, "https://www.thesportsdb.com/event/");
  assert.equal(
    posts.some((p) => p.title.includes("World Cup") || p.url.includes("ghost")),
    false,
  );

  const fromEvents = mapSportsDbSearch({
    events: [{ strEvent: "Premier League", idEvent: "4328" }],
  });
  assert.equal(fromEvents[0].url, "https://www.thesportsdb.com/event/4328");

  assert.deepEqual(mapSportsDbSearch({ event: {} }), []);
  assert.deepEqual(mapSportsDbSearch({}), []);
  assert.deepEqual(mapSportsDbSearch(null), []);
});

test("mapSportsDbPast prefers strVideo over the event URL and caps 8 after filter", () => {
  const posts = mapSportsDbPast({
    events: [
      ...Array.from({ length: 8 }, () => ({ idEvent: "empty" })),
      {
        strEvent: "Arsenal vs Chelsea",
        idEvent: "555",
        strVideo: "https://youtu.be/highlight",
        dateEvent: "2026-10-01",
      },
      { strEvent: "No Tape Derby", idEvent: "556" },
    ],
  });
  assert.equal(posts.length, 2);
  assert.equal(posts[0].title, "Arsenal vs Chelsea");
  assert.equal(posts[0].url, "https://youtu.be/highlight");
  assert.equal(posts[0].score, 55);
  assert.equal(posts[0].sourceApi, "TheSportsDB");
  assert.equal(posts[1].title, "No Tape Derby");
  assert.equal(posts[1].url, "https://www.thesportsdb.com/event/556");
  assert.deepEqual(mapSportsDbPast({ events: [{}] }), []);
  assert.deepEqual(mapSportsDbPast({}), []);
});

test("mapEspnScoreboard always uses espn.com, concatenates status, and drops missing names", () => {
  const posts = mapEspnScoreboard({
    events: [
      {
        name: "Arsenal vs Chelsea",
        date: "2026-10-12T14:00:00Z",
        status: { type: { description: "Final" } },
        links: [{ href: "https://www.espn.com/soccer/game/_/id/ghost" }],
      },
      { name: "NFL leftover", status: { type: {} } },
      { status: { type: { description: "In Progress" } } },
    ],
  });
  assert.equal(posts.length, 2);
  assert.equal(posts[0].title, "Arsenal vs Chelsea (Final)");
  assert.equal(posts[0].url, "https://www.espn.com/");
  assert.equal(posts[0].score, 58);
  assert.equal(posts[0].sourceApi, "ESPN");
  assert.equal(posts[0].createdAt, "2026-10-12T14:00:00Z");
  assert.equal(posts[1].title, "NFL leftover");
  assert.equal(posts[1].url, "https://www.espn.com/");
  assert.equal(
    posts.some((p) => p.url.includes("ghost") || p.title.includes("In Progress")),
    false,
  );
  assert.deepEqual(mapEspnScoreboard({ events: [{}] }), []);
  assert.deepEqual(mapEspnScoreboard({}), []);
  assert.deepEqual(mapEspnScoreboard(null), []);
});
