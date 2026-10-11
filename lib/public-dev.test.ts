import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mapDuckDuckGoPosts,
  mapGithubEvents,
  mapGithubSearch,
  mapNagerHolidays,
  mapReliefWeb,
} from "./public-apis";

test("mapGithubSearch prefixes GitHub:, invents github.com/{full_name} when html_url misses, and treats 0 stars as the rank fallback", () => {
  const posts = mapGithubSearch({
    items: [
      { full_name: "toyota/camry", html_url: "https://github.com/toyota/camry", stargazers_count: 2500 },
      { full_name: "ghost/noid" },
      { html_url: "https://github.com/untitled", stargazers_count: 99 },
      { full_name: "zero/stars", html_url: "https://github.com/zero/stars", stargazers_count: 0 },
    ],
  });
  assert.equal(posts.length, 3);
  assert.equal(posts[0].title, "GitHub: toyota/camry");
  assert.equal(posts[0].url, "https://github.com/toyota/camry");
  assert.equal(posts[0].score, 50);
  assert.equal(posts[0].sourceApi, "GitHub");
  assert.equal(posts[0].tool, "collect_public_apis");
  assert.equal(posts[1].title, "GitHub: ghost/noid");
  assert.equal(posts[1].url, "https://github.com/ghost/noid");
  assert.equal(posts[1].score, 76);
  assert.equal(posts[2].title, "GitHub: zero/stars");
  assert.equal(posts[2].score, 68);
  assert.equal(
    posts.some((p) => p.url.includes("untitled")),
    false,
  );
  assert.deepEqual(mapGithubSearch({}), []);
  assert.deepEqual(mapGithubSearch({ items: {} }), []);
});

test("mapGithubEvents aggregates by repo name, invents github.com URLs, and caps 8 after the count sort", () => {
  const rows = [
    { repo: { name: "toyota/camry" } },
    { repo: { name: "toyota/camry" } },
    { repo: { name: "ghost/noid" } },
    { repo: {} },
    ...Array.from({ length: 8 }, (_, i) => ({ repo: { name: `extra/${i}` } })),
  ];
  const posts = mapGithubEvents(rows);
  assert.equal(posts.length, 8);
  assert.equal(posts[0].title, "GitHub: toyota/camry");
  assert.equal(posts[0].url, "https://github.com/toyota/camry");
  assert.equal(posts[0].score, 24);
  assert.equal(posts[0].sourceApi, "GitHub");
  assert.equal(posts.some((p) => p.title.includes("ghost/noid")), true);
  assert.equal(posts.some((p) => !p.url.startsWith("https://github.com/")), false);
  assert.deepEqual(mapGithubEvents({}), []);
  assert.deepEqual(mapGithubEvents(null), []);
});

test("mapNagerHolidays always uses date.nager.at/, slices raw rows to 8 before dropping empties, and keeps a blank country code", () => {
  const posts = mapNagerHolidays([
    { name: "Camry Day", countryCode: "US", date: "2026-08-26" },
    { name: "No Country Fest" },
    { countryCode: "JP", date: "2026-01-01" },
    ...Array.from({ length: 8 }, () => ({ countryCode: "XX" })),
    { name: "Ninth Holiday", countryCode: "GB", date: "2026-12-25" },
  ]);
  assert.equal(posts.length, 2);
  assert.equal(posts[0].title, "US holiday: Camry Day");
  assert.equal(posts[0].url, "https://date.nager.at/");
  assert.equal(posts[0].score, 30);
  assert.equal(posts[0].sourceApi, "Nager.Date");
  assert.equal(posts[0].createdAt, "2026-08-26");
  assert.equal(posts[1].title, " holiday: No Country Fest");
  assert.equal(posts[1].url, "https://date.nager.at/");
  assert.equal(
    posts.some((p) => p.title.includes("Ninth")),
    false,
  );
  assert.deepEqual(mapNagerHolidays({}), []);
  assert.deepEqual(mapNagerHolidays(null), []);
});

test("mapReliefWeb keeps titled reports and always uses the ReliefWeb homepage — it does not invent a report URL", () => {
  const posts = mapReliefWeb({
    data: [
      {
        fields: {
          title: "Camry flood appeal",
          url: "https://reliefweb.int/report/camry-should-lose",
        },
      },
      { fields: { url: "https://reliefweb.int/report/untitled" } },
      { fields: {} },
    ],
  });
  assert.equal(posts.length, 1);
  assert.equal(posts[0].title, "Camry flood appeal");
  assert.equal(posts[0].url, "https://reliefweb.int/");
  assert.equal(posts[0].score, 65);
  assert.equal(posts[0].sourceApi, "ReliefWeb");
  assert.deepEqual(mapReliefWeb({}), []);
  assert.deepEqual(mapReliefWeb({ data: {} }), []);
});

test("mapDuckDuckGoPosts needs Heading+AbstractURL, uses AbstractText not Abstract, skips nested Topics, and throws when empty", () => {
  const hit = mapDuckDuckGoPosts({
    Heading: "Toyota Camry",
    AbstractText: "The Toyota Camry is a car.",
    AbstractURL: "https://en.wikipedia.org/wiki/Toyota_Camry",
    RelatedTopics: [
      { Text: "Camry Hybrid", FirstURL: "https://en.wikipedia.org/wiki/Toyota_Camry_Hybrid" },
      { Text: "Title only" },
      { Topics: [{ Text: "Nested should drop", FirstURL: "https://en.wikipedia.org/wiki/Ghost" }] },
    ],
  });
  assert.equal(hit.length, 2);
  assert.equal(hit[0].title, "Toyota Camry: The Toyota Camry is a car.");
  assert.equal(hit[0].url, "https://en.wikipedia.org/wiki/Toyota_Camry");
  assert.equal(hit[0].score, 70);
  assert.equal(hit[0].sourceApi, "DuckDuckGo");
  assert.equal(hit[1].title, "Camry Hybrid");
  assert.equal(hit[1].url, "https://en.wikipedia.org/wiki/Toyota_Camry_Hybrid");
  assert.equal(hit[1].score, 50);
  assert.equal(
    hit.some((p) => p.url.includes("Ghost")),
    false,
  );

  const headingOnly = mapDuckDuckGoPosts({
    Heading: "Toyota Camry",
    Abstract: "Research-style Abstract is ignored on the public tape.",
    AbstractURL: "https://en.wikipedia.org/wiki/Toyota_Camry",
  });
  assert.equal(headingOnly.length, 1);
  assert.equal(headingOnly[0].title, "Toyota Camry");

  assert.throws(() => mapDuckDuckGoPosts({ Abstract: "only text" }), /DuckDuckGo empty/);
  assert.throws(() => mapDuckDuckGoPosts({ AbstractURL: "https://en.wikipedia.org/wiki/Ghost" }), /DuckDuckGo empty/);
  assert.throws(() => mapDuckDuckGoPosts({ Heading: "Toyota Camry" }), /DuckDuckGo empty/);
  assert.throws(() => mapDuckDuckGoPosts({}), /DuckDuckGo empty/);
  assert.throws(() => mapDuckDuckGoPosts(null), /DuckDuckGo empty/);
});
