import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { POST as askPost } from "../app/api/ask/route";
import { GET as boosterGet } from "../app/api/booster/route";
import { GET as collectGet } from "../app/api/collect/route";
import { GET as insightsGet } from "../app/api/insights/route";
import { GET as researchGet } from "../app/api/research/route";
import { PATCH as watchPatch } from "../app/api/watchlist/route";

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

test("booster GET refuses to invent a footprint before the tape is loaded", async () => {
  const res = await boosterGet();
  assert.equal(res.status, 409);
  assert.match(await errorOf(res), /Load the tape first/);
});

test("ask POST with a real q still 409s when the tape is empty", async () => {
  const res = await askPost(jsonReq("http://localhost/api/ask", { q: "Camry" }));
  assert.equal(res.status, 409);
  assert.match(await errorOf(res), /Load the tape first/);
});

test("research GET requires a non-empty q before Wikipedia or Gemini", async () => {
  const empty = await researchGet(new NextRequest("http://localhost/api/research"));
  assert.equal(empty.status, 400);
  assert.match(await errorOf(empty), /q required/);

  const blank = await researchGet(new NextRequest("http://localhost/api/research?q=%20%20"));
  assert.equal(blank.status, 400);
  assert.match(await errorOf(blank), /q required/);
});

test("insights GET rejects crumbs shorter than two characters before root-trace", async () => {
  const empty = await insightsGet(new NextRequest("http://localhost/api/insights"));
  assert.equal(empty.status, 400);
  assert.match(await errorOf(empty), /q required/);

  const crumb = await insightsGet(new NextRequest("http://localhost/api/insights?q=a"));
  assert.equal(crumb.status, 400);
  assert.match(await errorOf(crumb), /q required/);

  const blank = await insightsGet(new NextRequest("http://localhost/api/insights?q=%20%20"));
  assert.equal(blank.status, 400);
  assert.match(await errorOf(blank), /q required/);
});

test("watchlist PATCH rejects a missing entityId or url before tagging", async () => {
  const noEntity = await watchPatch(
    jsonReq(
      "http://localhost/api/watchlist",
      { url: "https://nhtsa.test/camry", tag: "official" },
      "PATCH",
    ),
  );
  assert.equal(noEntity.status, 400);
  assert.match(await errorOf(noEntity), /entityId, url, and tag required/);

  const noUrl = await watchPatch(
    jsonReq("http://localhost/api/watchlist", { entityId: "camry", tag: "occupied" }, "PATCH"),
  );
  assert.equal(noUrl.status, 400);
  assert.match(await errorOf(noUrl), /entityId, url, and tag required/);
});

test("collect GET waits for a tape instead of inventing a snapshot", async () => {
  const prevHost = process.env.TREND_DB_HOST;
  const prevUser = process.env.TREND_DB_USER;
  delete process.env.TREND_DB_HOST;
  delete process.env.TREND_DB_USER;
  try {
    const res = await collectGet(new NextRequest("http://localhost/api/collect"));
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      waiting?: string;
      forecasts?: unknown;
      predicted?: unknown;
    };
    assert.match(body.waiting ?? "", /Load GET \/api\/trends first/);
    assert.equal(body.forecasts, undefined);
    assert.equal(body.predicted, undefined);
  } finally {
    if (prevHost === undefined) delete process.env.TREND_DB_HOST;
    else process.env.TREND_DB_HOST = prevHost;
    if (prevUser === undefined) delete process.env.TREND_DB_USER;
    else process.env.TREND_DB_USER = prevUser;
  }
});
