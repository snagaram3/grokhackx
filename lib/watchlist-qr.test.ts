import assert from "node:assert/strict";
import { test } from "node:test";
import type { PoiReceipt } from "./poi";
import { collectQr } from "./watchlist-store";

function receipt(url: string, title = "QR"): PoiReceipt {
  return {
    snapshotId: "s1",
    url,
    title,
    platform: "public",
    score: 10,
    createdAt: "2026-08-26T12:00:00.000Z",
  };
}

test("collectQr leftover decodes at most eight image URLs and skips encoded chart payloads", async () => {
  const orig = globalThis.fetch;
  const fetched: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    fetched.push(String(input));
    return { ok: false, status: 404, headers: new Headers(), arrayBuffer: async () => new ArrayBuffer(0) } as Response;
  }) as typeof fetch;
  try {
    const pngs = Array.from({ length: 10 }, (_, i) =>
      receipt(`https://qr.example/leftover-${i}.png`),
    );
    const chart = receipt(
      "https://chart.googleapis.com/chart?cht=qr&chl=https://camry.example/fit",
    );
    const wiki = receipt("https://en.wikipedia.org/wiki/Camry");
    const qr = await collectQr(null, [...pngs, chart, wiki]);
    assert.equal(fetched.length, 8);
    assert.ok(fetched.every((url) => url.endsWith(".png")));
    assert.equal(qr.get(chart.url), "https://camry.example/fit");
    assert.equal(qr.has(wiki.url), false);
    for (const row of pngs) {
      assert.equal(qr.has(row.url), false);
    }
  } finally {
    globalThis.fetch = orig;
  }
});
