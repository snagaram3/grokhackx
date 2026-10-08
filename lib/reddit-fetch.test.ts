import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchReddit } from "./reddit";

const LISTING = JSON.stringify({
  data: {
    children: [
      {
        data: {
          title: "CoverageRedditFetchCamryZz hybrid thread",
          permalink: "/r/worldnews/comments/1/camry",
          ups: 11,
          created_utc: 0,
        },
      },
      { data: { permalink: "/r/worldnews/comments/2/untitled" } },
    ],
  },
});

const RSS = `<?xml version="1.0"?><feed>
<entry><title>CoverageRedditRssCamryZz</title><link href="https://www.reddit.com/r/worldnews/comments/3/camry"/></entry>
</feed>`;

const ARCTIC = {
  data: [
    {
      title: "CoverageRedditArchiveCamryZz",
      permalink: "/r/worldnews/comments/4/camry",
      ups: 7,
      created_utc: 0,
    },
    { permalink: "/r/worldnews/comments/5/untitled" },
  ],
};

test("fetchReddit leftover official JSON stamps collect_reddit and drops untitled crumbs", async () => {
  const prevPath = process.env.PATH;
  process.env.PATH = "/tmp/coverage-no-curl";
  const orig = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("/r/worldnews/hot.json")) {
      return { ok: true, text: async () => LISTING } as Response;
    }
    throw new Error(`unexpected ${url}`);
  }) as typeof fetch;
  try {
    const posts = await fetchReddit(["worldnews"]);
    assert.equal(posts.length, 1);
    assert.equal(posts[0]?.title, "CoverageRedditFetchCamryZz hybrid thread");
    assert.equal(posts[0]?.url, "https://www.reddit.com/r/worldnews/comments/1/camry");
    assert.equal(posts[0]?.score, 11);
    assert.equal(posts[0]?.platform, "reddit");
    assert.equal(posts[0]?.tool, "collect_reddit");
    assert.equal(posts[0]?.createdAt, "1970-01-01T00:00:00.000Z");
    assert.ok(posts[0]?.collectedAt);
    assert.equal(calls.length, 1);
    assert.match(calls[0] ?? "", /worldnews\/hot\.json/);
  } finally {
    globalThis.fetch = orig;
    process.env.PATH = prevPath;
  }
});

test("fetchReddit leftover HTML-block falls through to RSS and does not invent a JSON tape", async () => {
  const prevPath = process.env.PATH;
  process.env.PATH = "/tmp/coverage-no-curl";
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("hot.json")) {
      return { ok: true, text: async () => "<html>blocked</html>" } as Response;
    }
    if (url.includes("hot/.rss")) {
      return { ok: true, text: async () => RSS } as Response;
    }
    throw new Error(`unexpected ${url}`);
  }) as typeof fetch;
  try {
    const posts = await fetchReddit(["worldnews"]);
    assert.equal(posts.length, 1);
    assert.equal(posts[0]?.title, "CoverageRedditRssCamryZz");
    assert.equal(posts[0]?.url, "https://www.reddit.com/r/worldnews/comments/3/camry");
    assert.equal(posts[0]?.tool, "collect_reddit");
    assert.ok((posts[0]?.score ?? 0) >= 5);
  } finally {
    globalThis.fetch = orig;
    process.env.PATH = prevPath;
  }
});

test("fetchReddit leftover official fail uses arctic-shift and does not invent archive titles", async () => {
  const prevPath = process.env.PATH;
  process.env.PATH = "/tmp/coverage-no-curl";
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("www.reddit.com") || url.includes("old.reddit.com")) {
      throw new Error("official blocked");
    }
    if (url.includes("arctic-shift.photon-reddit.com") && url.includes("subreddit=worldnews")) {
      return { ok: true, json: async () => ARCTIC } as Response;
    }
    throw new Error(`unexpected ${url}`);
  }) as typeof fetch;
  try {
    const posts = await fetchReddit(["worldnews"]);
    assert.equal(posts.length, 1);
    assert.equal(posts[0]?.title, "CoverageRedditArchiveCamryZz");
    assert.equal(posts[0]?.url, "https://www.reddit.com/r/worldnews/comments/4/camry");
    assert.equal(posts[0]?.tool, "collect_reddit");
  } finally {
    globalThis.fetch = orig;
    process.env.PATH = prevPath;
  }
});

test("fetchReddit leftover all-offline does not invent posts", async () => {
  const prevPath = process.env.PATH;
  process.env.PATH = "/tmp/coverage-no-curl";
  const orig = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("reddit leftover offline");
  }) as typeof fetch;
  try {
    await assert.rejects(() => fetchReddit(["worldnews"]), /reddit: all subreddits failed/);
  } finally {
    globalThis.fetch = orig;
    process.env.PATH = prevPath;
  }
});
