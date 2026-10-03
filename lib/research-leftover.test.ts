import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { GET as insightsGet } from "../app/api/insights/route";
import { GET as researchGet } from "../app/api/research/route";
import { researchTopic } from "./research";

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

function jsonRes(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function geminiEnvelope(text: string): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
    text: async () => "",
  } as Response;
}

function wikiSearch(): unknown {
  return [
    "Camry",
    ["Toyota Camry"],
    [""],
    ["https://en.wikipedia.org/wiki/Toyota_Camry"],
  ];
}

function wikiSummary(): unknown {
  return {
    title: "Toyota Camry",
    extract: "The Toyota Camry is a mid-size car.",
    content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Toyota_Camry" } },
  };
}

async function withFetch(
  impl: (url: string) => Response | Promise<Response>,
  fn: () => Promise<void>,
) {
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => impl(String(input))) as typeof fetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = orig;
  }
}

test("researchTopic empty query is thin and does not fetch", async () => {
  let fetches = 0;
  await withFetch(() => {
    fetches += 1;
    throw new Error("research empty must not fetch");
  }, async () => {
    const payload = await researchTopic("   ");
    assert.equal(payload.query, "");
    assert.equal(payload.thin, true);
    assert.deepEqual(payload.sources, []);
    assert.deepEqual(payload.findings, []);
    assert.equal(fetches, 0);
  });
});

test("researchTopic with every feed offline stays thin and does not invent receipts", async () => {
  await withFetch(() => {
    throw new Error("offline leftover");
  }, async () => {
    await withEnv("GOOGLE_API_KEY", undefined, async () => {
      await withEnv("GEMINI_API_KEY", undefined, async () => {
        const payload = await researchTopic("Camry");
        assert.equal(payload.query, "Camry");
        assert.equal(payload.thin, true);
        assert.equal(payload.sources.length, 0);
        assert.equal(payload.findings.length, 0);
        assert.ok(payload.degraded.some((d) => d.includes("offline")));
        assert.match(payload.summary, /nothing invented|Sources were thin or offline/i);
      });
    });
  });
});

test("researchTopic keeps a Wikipedia receipt and does not invent a WHY when Gemini is offline", async () => {
  await withFetch((url) => {
    if (url.includes("en.wikipedia.org/w/api.php")) return jsonRes(wikiSearch());
    if (url.includes("en.wikipedia.org/api/rest_v1/page/summary")) return jsonRes(wikiSummary());
    throw new Error(`offline leftover ${url}`);
  }, async () => {
    await withEnv("GOOGLE_API_KEY", undefined, async () => {
      await withEnv("GEMINI_API_KEY", undefined, async () => {
        const payload = await researchTopic("Camry");
        assert.equal(payload.sources.length, 1);
        assert.equal(payload.sources[0].kind, "wikipedia");
        assert.equal(payload.sources[0].title, "Toyota Camry");
        assert.equal(payload.sources[0].url, "https://en.wikipedia.org/wiki/Toyota_Camry");
        assert.ok(payload.sources[0].tool);
        assert.ok(payload.findings.length >= 1);
        assert.ok(payload.findings.every((f) => f.evidenceIds.includes(payload.sources[0].id)));
        assert.ok(payload.degraded.includes("gemini deep research offline"));
        assert.match(payload.summary, /live receipts/);
      });
    });
  });
});

test("researchTopic drops Gemini findings that cite ids that are not on the tape", async () => {
  await withFetch((url) => {
    if (url.includes("en.wikipedia.org/w/api.php")) return jsonRes(wikiSearch());
    if (url.includes("en.wikipedia.org/api/rest_v1/page/summary")) return jsonRes(wikiSummary());
    if (url.includes("generativelanguage.googleapis.com")) {
      return geminiEnvelope(
        JSON.stringify({
          summary: "Invented ghost citation.",
          findings: [
            { claim: "Ghost print", evidenceIds: ["ghost"], confidence: "high" },
            { claim: "Camry is a mid-size car.", evidenceIds: ["wikipedia-1", "invented"], confidence: "high" },
          ],
          openQuestions: [],
          angles: [],
        }),
      );
    }
    throw new Error(`offline leftover ${url}`);
  }, async () => {
    await withEnv("GOOGLE_API_KEY", "coverage-research-key", async () => {
      await withEnv("GEMINI_API_KEY", undefined, async () => {
        const payload = await researchTopic("Camry");
        assert.ok(payload.findings.length >= 1);
        assert.ok(payload.findings.every((f) => f.evidenceIds.every((id) => id === "wikipedia-1")));
        assert.equal(
          payload.findings.some((f) => f.evidenceIds.includes("ghost") || f.claim === "Ghost print"),
          false,
        );
        assert.ok(payload.findings.some((f) => f.claim.includes("Camry is a mid-size car")));
      });
    });
  });
});

test("research GET is 200 thin when gather is offline, and insights GET does not invent a root", async () => {
  await withFetch(() => {
    throw new Error("offline leftover http");
  }, async () => {
    await withEnv("GOOGLE_API_KEY", undefined, async () => {
      await withEnv("GEMINI_API_KEY", undefined, async () => {
        await withEnv("TREND_DB_HOST", undefined, async () => {
          await withEnv("TREND_DB_USER", undefined, async () => {
            const research = await researchGet(new NextRequest("http://localhost/api/research?q=Camry"));
            assert.equal(research.status, 200);
            const researchBody = (await research.json()) as {
              thin?: boolean;
              sources?: unknown[];
              findings?: unknown[];
              degraded?: string[];
            };
            assert.equal(researchBody.thin, true);
            assert.deepEqual(researchBody.sources, []);
            assert.deepEqual(researchBody.findings, []);
            assert.ok((researchBody.degraded ?? []).some((d) => d.includes("offline")));

            const insights = await insightsGet(new NextRequest("http://localhost/api/insights?q=Camry"));
            assert.equal(insights.status, 200);
            const insightsBody = (await insights.json()) as {
              thin?: boolean;
              originTitle?: string | null;
              receipts?: unknown[];
              layers?: { kind: string }[];
              degraded?: string[];
            };
            assert.equal(insightsBody.thin, true);
            assert.equal(insightsBody.originTitle ?? null, null);
            assert.deepEqual(insightsBody.receipts, []);
            assert.ok((insightsBody.layers ?? []).some((l) => l.kind === "plug"));
            assert.equal(
              (insightsBody.layers ?? []).some((l) => l.kind === "origin" || l.kind === "first-record"),
              false,
            );
            assert.ok((insightsBody.degraded ?? []).some((d) => d.includes("offline")));
          });
        });
      });
    });
  });
});
