import assert from "node:assert/strict";
import { test } from "node:test";
import { clusteredListSchema, postSchema } from "./schemas";

test("postSchema keeps optional proven geo and rejects a non-number lat", () => {
  const located = postSchema.parse({
    platform: "public",
    title: "M 6.2 - south of the Fiji Islands",
    url: "https://earthquake.usgs.gov/earthquakes/eventpage/us1",
    score: 80,
    createdAt: "2026-08-29T00:00:00.000Z",
    sourceApi: "USGS",
    geo: { lat: -23.1, lon: 179.2, label: "Fiji" },
  });
  assert.equal(located.geo?.lat, -23.1);

  const bare = postSchema.parse({
    platform: "hn",
    title: "Toyota plans Camry recall",
    url: "https://news.ycombinator.com/item?id=1",
    score: 40,
    createdAt: "2026-08-29T00:00:00.000Z",
  });
  assert.equal(bare.geo, undefined);

  assert.throws(() =>
    postSchema.parse({
      platform: "public",
      title: "bad geo",
      url: "https://earthquake.usgs.gov/earthquakes/eventpage/us2",
      score: 10,
      createdAt: "2026-08-29T00:00:00.000Z",
      geo: { lat: "south", lon: 179.2, label: "Fiji" },
    }),
  );
});

test("clusteredListSchema still requires at least one topic after geo landed", () => {
  assert.throws(() => clusteredListSchema.parse({ topics: [] }));
});
