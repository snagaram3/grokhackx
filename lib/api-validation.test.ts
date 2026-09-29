import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { POST as askPost } from "../app/api/ask/route";
import { GET as compareGet } from "../app/api/ai-agents/compare/route";
import { GET as collectGet } from "../app/api/collect/route";
import { POST as fleetPost } from "../app/api/fleet/route";
import { POST as rlPost } from "../app/api/rl/route";
import { DELETE as watchDelete, PATCH as watchPatch, POST as watchPost } from "../app/api/watchlist/route";

function jsonReq(url: string, body: unknown, method = "POST"): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function errorOf(res: Response): Promise<string> {
  const body = (await res.json()) as { error?: string };
  return body.error ?? "";
}

test("compare GET rejects missing, thin, and oversized id lists before lookup", async () => {
  const missing = await compareGet(new NextRequest("http://localhost/api/ai-agents/compare"));
  assert.equal(missing.status, 400);
  assert.match(await errorOf(missing), /ids/i);

  const one = await compareGet(new NextRequest("http://localhost/api/ai-agents/compare?ids=gpt-4"));
  assert.equal(one.status, 400);
  assert.match(await errorOf(one), /At least 2/);

  const thin = await compareGet(new NextRequest("http://localhost/api/ai-agents/compare?ids=,+"));
  assert.equal(thin.status, 400);
  assert.match(await errorOf(thin), /At least 2/);

  const seven = await compareGet(
    new NextRequest("http://localhost/api/ai-agents/compare?ids=a,b,c,d,e,f,g"),
  );
  assert.equal(seven.status, 400);
  assert.match(await errorOf(seven), /Maximum 6/);
});

test("ask POST requires a non-empty q before touching the tape", async () => {
  const empty = await askPost(jsonReq("http://localhost/api/ask", {}));
  assert.equal(empty.status, 400);
  assert.match(await errorOf(empty), /q required/);

  const blank = await askPost(jsonReq("http://localhost/api/ask", { q: "  " }));
  assert.equal(blank.status, 400);
  assert.match(await errorOf(blank), /q required/);
});

test("watchlist POST/PATCH/DELETE reject short labels, junk tags, and missing ids", async () => {
  const short = await watchPost(jsonReq("http://localhost/api/watchlist", { label: "x" }));
  assert.equal(short.status, 400);
  assert.match(await errorOf(short), /label too short/);

  const tag = await watchPatch(
    jsonReq("http://localhost/api/watchlist", { entityId: "camry", url: "https://nhtsa.test/camry", tag: "gold" }, "PATCH"),
  );
  assert.equal(tag.status, 400);
  assert.match(await errorOf(tag), /tag required/);

  const missing = await watchDelete(new NextRequest("http://localhost/api/watchlist", { method: "DELETE" }));
  assert.equal(missing.status, 400);
  assert.match(await errorOf(missing), /id required/);
});

test("rl POST requires a feed name before recording a reward", async () => {
  const empty = await rlPost(jsonReq("http://localhost/api/rl", {}));
  assert.equal(empty.status, 400);
  assert.match(await errorOf(empty), /feed or feeds required/);

  const blank = await rlPost(jsonReq("http://localhost/api/rl", { feed: "  ", feeds: [" "] }));
  assert.equal(blank.status, 400);
  assert.match(await errorOf(blank), /feed or feeds required/);
});

test("fleet POST rejects a crumb phrase before calling Cloud Run", async () => {
  const empty = await fleetPost(jsonReq("http://localhost/api/fleet", {}));
  assert.equal(empty.status, 400);
  assert.match(await errorOf(empty), /phrase too short/);

  const crumb = await fleetPost(jsonReq("http://localhost/api/fleet", { phrase: " a " }));
  assert.equal(crumb.status, 400);
  assert.match(await errorOf(crumb), /phrase too short/);
});

test("collect hourly is unauthorized when CRON_SECRET is set and Bearer is missing", async () => {
  const prev = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "coverage-hourly-secret";
  try {
    const res = await collectGet(new NextRequest("http://localhost/api/collect?hourly=1"));
    assert.equal(res.status, 401);
    assert.match(await errorOf(res), /unauthorized/);
  } finally {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  }
});
