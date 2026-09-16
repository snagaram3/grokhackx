import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateAgentCosts, parseTokenCount } from "./ai-agents-cost";
import type { AIAgent } from "./ai-agents-types";

function agent(
  partial: Partial<AIAgent> & Pick<AIAgent, "id" | "name" | "pricing">,
): Pick<AIAgent, "id" | "name" | "pricing"> {
  return { id: partial.id, name: partial.name, pricing: partial.pricing };
}

test("parseTokenCount treats empty, garbage, and zero as 0", () => {
  assert.equal(parseTokenCount("500000"), 500000);
  assert.equal(parseTokenCount("0"), 0);
  assert.equal(parseTokenCount(""), 0);
  assert.equal(parseTokenCount("abc"), 0);
  assert.equal(parseTokenCount("-"), 0);
});

test("estimateAgentCosts skips listings without both rates and sorts by total", () => {
  const estimates = estimateAgentCosts(
    [
      agent({
        id: "paid",
        name: "Paid",
        pricing: { tier: "paid", inputCost: 30, outputCost: 60, currency: "USD" },
      }),
      agent({
        id: "free",
        name: "Free",
        pricing: { tier: "free" },
      }),
      agent({
        id: "input-only",
        name: "InputOnly",
        pricing: { tier: "paid", inputCost: 10, currency: "USD" },
      }),
      agent({
        id: "zero",
        name: "Zero",
        pricing: { tier: "freemium", inputCost: 0, outputCost: 0, currency: "USD" },
      }),
    ],
    500_000,
    500_000,
  );

  assert.deepEqual(
    estimates.map((e) => e.agentId),
    ["zero", "paid"],
  );
  assert.equal(estimates[0].totalCost, 0);
  assert.equal(estimates.find((e) => e.agentId === "paid")?.inputCost, 15);
  assert.equal(estimates.find((e) => e.agentId === "paid")?.outputCost, 30);
  assert.equal(estimates.find((e) => e.agentId === "paid")?.totalCost, 45);
});

test("0/0 freemium is cheapest; price ratio is Infinity when the floor is 0", () => {
  const estimates = estimateAgentCosts(
    [
      agent({
        id: "zero",
        name: "Zero",
        pricing: { tier: "freemium", inputCost: 0, outputCost: 0, currency: "USD" },
      }),
      agent({
        id: "paid",
        name: "Paid",
        pricing: { tier: "paid", inputCost: 2, outputCost: 4, currency: "USD" },
      }),
    ],
    1_000_000,
    1_000_000,
  );
  assert.equal(estimates[0].agentId, "zero");
  assert.equal(estimates[estimates.length - 1].totalCost / estimates[0].totalCost, Infinity);
});
