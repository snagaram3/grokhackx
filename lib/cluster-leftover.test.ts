import assert from "node:assert/strict";
import { test } from "node:test";
import { attachPublicPosts } from "./cluster";
import type { Post, Topic } from "./types";

function empty() {
  return { score: 0, posts: [] as Post[] };
}

function camry(): Topic {
  return {
    id: "camry",
    label: "Camry",
    platforms: { x: empty(), reddit: empty(), hn: empty(), public: empty() },
    velocity: "rising",
    divergence: 0.25,
    tickers: [],
  };
}

function post(title: string, url: string, extra: Partial<Post> = {}): Post {
  return {
    platform: "public",
    title,
    url,
    score: extra.score ?? 40,
    createdAt: extra.createdAt ?? "2026-08-29T00:00:00.000Z",
    sourceApi: extra.sourceApi ?? "National Weather Service",
    ...extra,
  };
}

test("attachPublicPosts leftover NWS titles that share a prefix get unique ids", () => {
  const prefix =
    "Winter Storm Warning issued August 29 at 4:00AM CDT until August 30 at 12:00PM CDT by NWS";
  const chicago = post(`${prefix} Chicago IL`, "https://api.weather.gov/alerts/urn:oid:1");
  const milwaukee = post(`${prefix} Milwaukee WI`, "https://api.weather.gov/alerts/urn:oid:2");
  const attached = attachPublicPosts([camry()], [chicago, milwaukee]);
  const leftovers = attached.filter((t) => t.id !== "camry");
  assert.equal(leftovers.length, 2);
  assert.notEqual(leftovers[0]?.id, leftovers[1]?.id);
  assert.ok(leftovers.every((t) => t.id.includes("urn-oid")));
});

test("attachPublicPosts leftover ids stay unique even when titles slug-collide", () => {
  const title = "Heat advisory for the greater metro area this afternoon";
  const a = post(title, "https://api.weather.gov/alerts/aaa", { sourceApi: "National Weather Service" });
  const b = post(title, "https://api.weather.gov/alerts/bbb", { sourceApi: "National Weather Service" });
  const leftovers = attachPublicPosts([], [a, b]);
  assert.equal(leftovers.length, 2);
  assert.notEqual(leftovers[0]?.id, leftovers[1]?.id);
  assert.equal(new Set(leftovers.map((t) => t.id)).size, 2);
});

test("attachPublicPosts still attaches a Camry-matching public receipt to the tape topic", () => {
  const recall = post("Camry hybrid recall notice", "https://www.nhtsa.gov/camry", {
    sourceApi: "NHTSA",
    score: 80,
  });
  const weather = post(
    "Winter Storm Warning issued August 29 at 4:00AM CDT until August 30 at 12:00PM CDT by NWS Chicago IL",
    "https://api.weather.gov/alerts/urn:oid:9",
  );
  const attached = attachPublicPosts([camry()], [recall, weather]);
  assert.equal(attached[0]?.id, "camry");
  assert.ok(attached[0]?.platforms.public.posts.some((p) => p.url.includes("nhtsa")));
  const leftover = attached.filter((t) => t.id !== "camry");
  assert.equal(leftover.length, 1);
  assert.equal(leftover[0]?.platforms.public.posts[0]?.sourceApi, "National Weather Service");
});
