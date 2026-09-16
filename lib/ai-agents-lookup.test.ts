import assert from "node:assert/strict";
import { test } from "node:test";
import { missingAgentIds, resolveCompareAgents } from "./ai-agents-compare";

test("missingAgentIds lists unknown ids and keeps duplicate missing crumbs", () => {
  assert.deepEqual(missingAgentIds(["gpt-4", "claude"], ["gpt-4"]), ["claude"]);
  assert.deepEqual(missingAgentIds(["gpt-4", "gpt-4"], ["gpt-4"]), []);
  assert.deepEqual(missingAgentIds(["gone", "gone"], []), ["gone", "gone"]);
  assert.deepEqual(missingAgentIds(["a", "b"], ["a", "b"]), []);
});

test("resolveCompareAgents 404s unknown ids and keeps duplicate known rows", () => {
  const catalog = new Map([
    ["gpt-4", { id: "gpt-4", name: "GPT-4" }],
    ["claude", { id: "claude", name: "Claude" }],
  ]);
  const getById = (id: string) => catalog.get(id);

  const ok = resolveCompareAgents(["gpt-4", "claude"], getById);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.deepEqual(ok.agents.map((a) => a.id), ["gpt-4", "claude"]);

  const missing = resolveCompareAgents(["gpt-4", "nope"], getById);
  assert.deepEqual(missing, { ok: false, missing: ["nope"] });

  const dupes = resolveCompareAgents(["gpt-4", "gpt-4"], getById);
  assert.equal(dupes.ok, true);
  if (dupes.ok) {
    assert.equal(dupes.agents.length, 2);
    assert.deepEqual(dupes.agents.map((a) => a.id), ["gpt-4", "gpt-4"]);
  }
});
