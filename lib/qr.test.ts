import assert from "node:assert/strict";
import { test } from "node:test";
import { DECODE_QR_MS, QR_IMAGE_ACCEPT, decodeQrFromImageUrl } from "./qr";

function acceptOf(init?: RequestInit): string {
  const headers = init?.headers;
  if (!headers) return "";
  if (headers instanceof Headers) return headers.get("accept") ?? "";
  if (Array.isArray(headers)) {
    const hit = headers.find(([key]) => key.toLowerCase() === "accept");
    return hit?.[1] ?? "";
  }
  const rec = headers as Record<string, string>;
  return rec.accept ?? rec.Accept ?? "";
}

test("QR image decode aborts at 2.5s and asks only for png/jpeg", () => {
  assert.equal(DECODE_QR_MS, 2_500);
  assert.ok(DECODE_QR_MS < 8_000);
  assert.ok(DECODE_QR_MS < 55_000);
  assert.equal(QR_IMAGE_ACCEPT, "image/png,image/jpeg");
  assert.equal(QR_IMAGE_ACCEPT.includes("rss"), false);
  assert.equal(QR_IMAGE_ACCEPT.includes("*/*"), false);
});

test("decodeQrFromImageUrl fetch throw is null and does not invent a campaign payload", async () => {
  const orig = globalThis.fetch;
  let called = 0;
  let url = "";
  let accept = "";
  let hadSignal = false;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    called += 1;
    url = String(input);
    accept = acceptOf(init);
    hadSignal = init?.signal instanceof AbortSignal;
    throw new TypeError("network down");
  }) as typeof fetch;
  try {
    const decoded = await decodeQrFromImageUrl("https://cdn.example/campaign/heat.png");
    assert.equal(decoded, null);
    assert.notEqual(decoded, "https://camry.example/fit");
    assert.equal(called, 1);
    assert.equal(url, "https://cdn.example/campaign/heat.png");
    assert.equal(accept, QR_IMAGE_ACCEPT);
    assert.equal(hadSignal, true);
  } finally {
    globalThis.fetch = orig;
  }
});
