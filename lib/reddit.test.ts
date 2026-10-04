import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchReddit, parseAtom, parseListing, rankScores } from "./reddit";
import type { Post } from "./types";

function post(title: string, score: number): Post {
  return {
    platform: "reddit",
    title,
    url: `https://www.reddit.com/r/cars/comments/${encodeURIComponent(title)}`,
    score,
    createdAt: "2026-08-26T12:00:00.000Z",
  };
}

test("parseListing drops stickied rows and prefers permalink over the outbound url", () => {
  const posts = parseListing({
    data: {
      children: [
        {
          data: {
            title: "Stickied rules",
            permalink: "/r/cars/comments/1/rules",
            url: "https://www.reddit.com/r/cars/",
            stickied: true,
            ups: 999,
            created_utc: 1,
          },
        },
        {
          data: {
            title: "Camry thread",
            permalink: "/r/cars/comments/1/camry",
            url: "https://out.example/camry",
            ups: 12,
            created_utc: 0,
          },
        },
        {
          data: {
            title: "No permalink",
            url: "https://old.reddit.com/r/cars/comments/2/leaf",
            score: 7,
            created_utc: 0,
          },
        },
        { data: { permalink: "/r/cars/comments/3/untitled" } },
      ],
    },
  });
  assert.deepEqual(
    posts.map((p) => ({ title: p.title, url: p.url, score: p.score })),
    [
      {
        title: "Camry thread",
        url: "https://www.reddit.com/r/cars/comments/1/camry",
        score: 12,
      },
      {
        title: "No permalink",
        url: "https://old.reddit.com/r/cars/comments/2/leaf",
        score: 7,
      },
    ],
  );
  assert.equal(posts[0]?.createdAt, "1970-01-01T00:00:00.000Z");
});

test("parseAtom leftover CDATA titles are stripped, subreddit homes drop, and zero scores rank", () => {
  const xml = `<?xml version="1.0"?>
<feed>
  <entry>
    <title><![CDATA[Camry recall]]></title>
    <link href="https://www.reddit.com/r/cars/comments/1/camry" />
    <published>2026-08-26T12:00:00.000Z</published>
  </entry>
  <entry>
    <title>Camry &amp; recall</title>
    <link href="https://www.reddit.com/r/cars/comments/1/camry" />
    <published>2026-08-26T12:00:00.000Z</published>
  </entry>
  <entry>
    <title>Sub home</title>
    <link href="https://www.reddit.com/r/cars/" />
    <published>2026-08-26T12:00:00.000Z</published>
  </entry>
  <entry>
    <title>Leaf thread</title>
    <link href="https://www.reddit.com/r/cars/comments/2/leaf" />
    <updated>2026-08-26T13:00:00.000Z</updated>
  </entry>
</feed>`;
  const posts = parseAtom(xml);
  assert.equal(posts.length, 2);
  assert.equal(posts[0]?.title, "Camry & recall");
  assert.equal(posts[0]?.url, "https://www.reddit.com/r/cars/comments/1/camry");
  assert.equal(posts[0]?.score, 90);
  assert.equal(posts[1]?.title, "Leaf thread");
  assert.equal(posts[1]?.score, 88);
  assert.equal(posts[0]?.createdAt, "2026-08-26T12:00:00.000Z");
  assert.equal(
    posts.some((p) => p.title === "Camry recall"),
    false,
    "tag-strip eats CDATA wrappers, so a CDATA-only title is dropped rather than invented",
  );
});

test("parseAtom leftover junk and empty feeds throw instead of inventing posts", () => {
  assert.throws(() => parseAtom("not atom"), /not atom\/rss/);
  assert.throws(
    () =>
      parseAtom(`<feed><entry><title>Sub only</title><link href="https://www.reddit.com/r/cars/" /></entry></feed>`),
    /rss empty/,
  );
});

test("rankScores keeps real scores and only fills a 90/88 ladder when every score is 0 or 1", () => {
  const kept = rankScores([post("hot", 40), post("warm", 12)]);
  assert.deepEqual(
    kept.map((p) => p.score),
    [40, 12],
  );
  const filled = rankScores([post("a", 0), post("b", 1), post("c", 0)]);
  assert.deepEqual(
    filled.map((p) => p.score),
    [90, 88, 86],
  );
});

test("fetchReddit leftover blank subs throw before any network call", async () => {
  const orig = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    throw new Error("should not fetch");
  }) as typeof fetch;
  try {
    await assert.rejects(() => fetchReddit(["  ", ""]), /reddit: no subreddits/);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = orig;
  }
});
