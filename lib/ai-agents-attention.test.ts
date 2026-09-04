import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attentionScore,
  buildMetrics,
  rateOfChange,
  velocityFromRoc,
} from "./ai-agents-attention";
import { getAIAgentsStore, resetAIAgentsStore } from "./ai-agents-store";
import { generateWeeklyRead } from "./ai-agents-weekly";

describe("ai-agents-attention", () => {
  it("weights rate of change over volume", () => {
    const highVolumeLowRoc = attentionScore(1000, 0, 1000);
    const lowVolumeHighRoc = attentionScore(100, 100, 1000);
    assert.ok(lowVolumeHighRoc > highVolumeLowRoc);
  });

  it("computes rate of change", () => {
    assert.equal(rateOfChange(150, 100), 50);
    assert.equal(rateOfChange(50, 100), -50);
    assert.equal(rateOfChange(10, 0), 100);
  });

  it("maps velocity from roc", () => {
    assert.equal(velocityFromRoc(50), "rising");
    assert.equal(velocityFromRoc(20), "peaking");
    assert.equal(velocityFromRoc(-30), "fading");
    assert.equal(velocityFromRoc(0), "stable");
  });

  it("builds metrics with attention aliases", () => {
    const m = buildMetrics({
      mentions: 200,
      mentionsPrior: 100,
      maxMentions: 200,
      totalMentions: 400,
      platformShares: { hn: 80, reddit: 60, x: 40, github: 20 },
    });
    assert.equal(m.rateOfChange, 100);
    assert.equal(m.weekly_change, m.rateOfChange);
    assert.equal(m.trend_score, m.attention);
    assert.equal(m.mentionsPrior, 100);
    assert.ok(m.concentration > 0);
  });
});

describe("ai-agents-store", () => {
  it("never returns empty agents", () => {
    resetAIAgentsStore();
    const store = getAIAgentsStore();
    const payload = store.getPayload();
    assert.ok(payload.agents.length >= 8);
    assert.ok(payload.sources.length > 0);
    assert.ok(payload.trends.length > 0);
    assert.equal(payload.metadata.windowLabel.includes("week"), true);
  });

  it("sorts by rate of change by default", () => {
    resetAIAgentsStore();
    const agents = getAIAgentsStore().getAll();
    for (let i = 1; i < agents.length; i++) {
      assert.ok(agents[i - 1].metrics.rateOfChange >= agents[i].metrics.rateOfChange);
    }
  });

  it("filters by minRateOfChange", () => {
    resetAIAgentsStore();
    const agents = getAIAgentsStore().getAll({ minRateOfChange: 1000 });
    assert.equal(agents.length, 0);
  });

  it("links insights to source ids and never says adoption", () => {
    resetAIAgentsStore();
    const store = getAIAgentsStore();
    const agents = store.getAll();
    const insights = store.generateInsights(agents);
    const blob = JSON.stringify(insights).toLowerCase();
    assert.equal(blob.includes("adoption"), false);
    assert.ok(insights.some((i) => i.type === "attention"));
  });
});

describe("ai-agents-weekly", () => {
  it("generates sourced weekly read without unsourced claims", () => {
    resetAIAgentsStore();
    const store = getAIAgentsStore();
    const agents = store.getAll();
    const sources = store.getSources();
    const weekly = generateWeeklyRead(agents, sources);
    assert.ok(weekly.sections.length > 0);
    assert.ok(weekly.sourceCount > 0);
    for (const section of weekly.sections) {
      for (const claim of section.claims) {
        assert.ok(claim.sourceIds.length > 0, `claim missing sources: ${claim.text}`);
        for (const id of claim.sourceIds) {
          assert.ok(sources.some((s) => s.id === id));
        }
      }
    }
    assert.equal(JSON.stringify(weekly).toLowerCase().includes("adoption"), false);
  });
});
