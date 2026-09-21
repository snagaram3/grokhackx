import assert from "node:assert/strict";
import { test } from "node:test";
import { banditSnapshot, recordPulls, recordReward, topicBoost } from "./rl";

test("topicBoost is 1 with no feeds and 1.5 for never-pulled names", () => {
  assert.equal(topicBoost([]), 1);
  assert.equal(topicBoost(["coverage-never-pulled-feed"]), 1.5);
});

test("recordReward clamps to [0, 1] and then topicBoost uses the mean", () => {
  const name = `coverage-reward-${Date.now()}`;
  const high = recordReward(name, 4);
  assert.equal(high.reward, 1);
  assert.ok(high.pulls >= 1);

  const low = recordReward(name, -2);
  assert.equal(low.reward, 1);

  const mid = recordReward(`coverage-reward-mid-${Date.now()}`, 0.25);
  assert.equal(mid.reward, 0.25);
  assert.equal(topicBoost([name]), 2);
});

test("recordPulls increments the named arm, including duplicate names in one call", () => {
  const name = `coverage-pulls-${Date.now()}`;
  recordPulls([name, name]);
  const arm = banditSnapshot().find((a) => a.name === name);
  assert.equal(arm?.pulls, 2);
  recordPulls([name]);
  assert.equal(banditSnapshot().find((a) => a.name === name)?.pulls, 3);
});
