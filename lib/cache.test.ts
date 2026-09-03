import assert from "node:assert/strict";
import { test } from "node:test";
import { cacheGet, cachePeek, cacheSet } from "./cache";

const TTL_MS = 15 * 60 * 1000;

test("cacheGet misses unknown keys and cachePeek still reads a just-set value", () => {
  const key = `cache-test:${Date.now()}:miss`;
  assert.equal(cacheGet(key), undefined);
  assert.equal(cachePeek(key), undefined);
  cacheSet(key, { tape: "camry" });
  assert.deepEqual(cacheGet(key), { tape: "camry" });
  assert.deepEqual(cachePeek(key), { tape: "camry" });
});

test("cacheGet honors TTL while cachePeek keeps the expired entry", () => {
  const key = `cache-test:${Date.now()}:ttl`;
  const realNow = Date.now;
  try {
    Date.now = () => 1_000;
    cacheSet(key, "live-tape");
    Date.now = () => 1_000 + TTL_MS;
    assert.equal(cacheGet(key), "live-tape");
    Date.now = () => 1_000 + TTL_MS + 1;
    assert.equal(cacheGet(key), undefined);
    // collect/trends still read expired tape through peek so a cold hour does not drop the last snap.
    assert.equal(cachePeek(key), "live-tape");
  } finally {
    Date.now = realNow;
  }
});
