import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { GET as getAgents } from "../app/api/ai-agents/route";
import { GET as compareAgentsRoute } from "../app/api/ai-agents/compare/route";

test("compare route leftover markdown format is text/markdown, not JSON ranking", async () => {
  const req = new NextRequest(
    "http://localhost/api/ai-agents/compare?ids=gpt-4,claude-3.5-sonnet&format=markdown",
  );
  const res = await compareAgentsRoute(req);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /text\/markdown/);
  const body = await res.text();
  assert.match(body, /# AI Agents Comparison/);
  assert.match(body, /Overall Leader/);
});

test("compare route leftover default format is JSON with a summary object", async () => {
  const req = new NextRequest(
    "http://localhost/api/ai-agents/compare?ids=gpt-4,llama-3",
  );
  const res = await compareAgentsRoute(req);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { summary?: { overallLeader?: string }; agents?: unknown[] };
  assert.equal(typeof body.summary?.overallLeader, "string");
  assert.ok(Array.isArray(body.agents));
  assert.equal(body.agents.length, 2);
});

test("list route leftover attaches generateInsights onto the payload", async () => {
  const req = new NextRequest("http://localhost/api/ai-agents");
  const res = await getAgents(req);
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    agents?: unknown[];
    insights?: { type?: string; title?: string; confidence?: number; agents?: string[]; evidence?: string[] }[];
    metadata?: { total?: number };
    updatedAt?: string;
  };
  assert.ok(Array.isArray(body.agents));
  assert.ok(Array.isArray(body.insights));
  assert.ok((body.insights?.length ?? 0) > 0);
  const insight = body.insights![0];
  assert.equal(typeof insight.type, "string");
  assert.equal(typeof insight.title, "string");
  assert.equal(typeof insight.confidence, "number");
  assert.ok(Array.isArray(insight.agents));
  assert.ok(Array.isArray(insight.evidence));
  assert.equal(typeof body.metadata?.total, "number");
  assert.equal(typeof body.updatedAt, "string");
});
