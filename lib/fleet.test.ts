import assert from "node:assert/strict";
import { test } from "node:test";
import { fleetBaseUrl, fleetChip, fleetHealth, fleetIngest } from "./fleet";

function withEnv(key: string, value: string | undefined, fn: () => Promise<void> | void) {
  const prev = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  const restore = () => {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  };
  try {
    const out = fn();
    if (out && typeof (out as Promise<void>).then === "function") {
      return (out as Promise<void>).finally(restore);
    }
  } catch (err) {
    restore();
    throw err;
  }
  restore();
}

test("fleetBaseUrl strips a trailing slash", () => {
  return withEnv("FLEET_URL", "https://fleet.example/", () => {
    assert.equal(fleetBaseUrl(), "https://fleet.example");
  });
});

test("fleetChip reports ready, offline, and unset without inventing health", () => {
  assert.equal(fleetChip(null), null);
  assert.equal(fleetChip({ configured: true, ok: true, ms: 12 }), "Fleet ready");
  assert.equal(fleetChip({ configured: true, ok: false, ms: 40 }), "Fleet offline · live tape");
  assert.equal(fleetChip({ configured: false, ok: false, ms: 0 }), "Fleet unset · live tape");
});

test("fleetHealth skips the network when FLEET_URL is missing", async () => {
  await withEnv("FLEET_URL", undefined, async () => {
    const health = await fleetHealth(50);
    assert.deepEqual(health, { configured: false, ok: false, ms: 0 });
  });
});

test("fleetHealth and fleetIngest use /health and /v1/ingest without a live fleet", async () => {
  const orig = globalThis.fetch;
  const calls: { url: string; method?: string }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method });
    if (url.endsWith("/health")) return { ok: true } as Response;
    return { ok: true, status: 200, text: async () => "snapped" } as Response;
  }) as typeof fetch;
  try {
    await withEnv("FLEET_URL", "https://fleet.example/", async () => {
      const health = await fleetHealth(80);
      assert.equal(health.configured, true);
      assert.equal(health.ok, true);
      const ingest = await fleetIngest("Camry");
      assert.equal(ingest.ok, true);
      assert.equal(ingest.status, 200);
      assert.equal(ingest.text, "snapped");
    });
    assert.ok(calls.some((c) => c.url === "https://fleet.example/health"));
    assert.ok(calls.some((c) => c.url === "https://fleet.example/v1/ingest" && c.method === "POST"));
  } finally {
    globalThis.fetch = orig;
  }
});

test("fleetIngest maps missing URL to 503 and TimeoutError to 504", async () => {
  await withEnv("FLEET_URL", undefined, async () => {
    const missing = await fleetIngest("Camry");
    assert.equal(missing.ok, false);
    assert.equal(missing.status, 503);
    assert.match(missing.text, /FLEET_URL missing/);
  });

  const orig = globalThis.fetch;
  globalThis.fetch = (async () => {
    const err = new Error("aborted");
    err.name = "TimeoutError";
    throw err;
  }) as typeof fetch;
  try {
    await withEnv("FLEET_URL", "https://fleet.example", async () => {
      const timed = await fleetIngest("Camry");
      assert.equal(timed.status, 504);
      assert.match(timed.text, /timed out/);
    });
  } finally {
    globalThis.fetch = orig;
  }

  globalThis.fetch = (async () => {
    throw new Error("ECONNREFUSED");
  }) as typeof fetch;
  try {
    await withEnv("FLEET_URL", "https://fleet.example", async () => {
      const down = await fleetIngest("Camry");
      assert.equal(down.status, 503);
      assert.equal(down.text, "fleet unreachable");
    });
  } finally {
    globalThis.fetch = orig;
  }
});
