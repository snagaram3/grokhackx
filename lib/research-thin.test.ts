import assert from "node:assert/strict";
import { test } from "node:test";
import { sliceResearchPayload } from "./research-pack";
import { postsToSources, thinBrief } from "./research";
import type { ResearchPayload, ResearchSource } from "./types";

function src(
  partial: Partial<ResearchSource> & Pick<ResearchSource, "id" | "kind" | "title" | "url">,
): ResearchSource {
  return { snippet: partial.title, ...partial };
}

test("postsToSources stamps kind-n ids from live posts and does not invent a URL or drop a blank title", () => {
  const rows = postsToSources(
    "hn",
    [
      {
        title: "Toyota Camry recall",
        url: "https://news.ycombinator.com/item?id=1",
        score: 42,
        createdAt: "2026-08-26T12:00:00.000Z",
        tool: "collect_hn",
        collectedAt: "2026-08-26T12:01:00.000Z",
      },
      {
        title: "B".repeat(240),
        url: "https://news.ycombinator.com/item?id=2",
        score: 7,
        createdAt: "2026-08-26T13:00:00.000Z",
      },
      {
        title: "",
        url: "https://news.ycombinator.com/item?id=3",
        score: 1,
        createdAt: "2026-08-26T14:00:00.000Z",
      },
    ],
    2,
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, "hn-1");
  assert.equal(rows[0].kind, "hn");
  assert.equal(rows[0].title, "Toyota Camry recall");
  assert.equal(rows[0].snippet, "Toyota Camry recall");
  assert.equal(rows[0].score, 42);
  assert.equal(rows[0].tool, "collect_hn");
  assert.equal(rows[0].collectedAt, "2026-08-26T12:01:00.000Z");
  assert.equal(rows[1].id, "hn-2");
  assert.equal(rows[1].title.length, 200);
  assert.equal(rows[1].snippet.length, 240);
  assert.deepEqual(postsToSources("reddit", [], 10), []);
  const blank = postsToSources(
    "public",
    [{ title: "", url: "https://trends.google.com/", score: 3, createdAt: "2026-08-26T12:00:00.000Z" }],
    8,
  );
  assert.equal(blank[0].id, "public-1");
  assert.equal(blank[0].title, "");
  assert.equal(blank[0].kind, "public");
});

test("thinBrief marks findings medium only when 6+ sources exist and does not trim a whitespace claim", () => {
  const five = Array.from({ length: 5 }, (_, i) =>
    src({
      id: `wikipedia-${i + 1}`,
      kind: "wikipedia",
      title: `Toyota Camry ${i + 1}`,
      url: `https://en.wikipedia.org/wiki/Toyota_Camry_${i + 1}`,
      snippet: `Camry note ${i + 1}`,
    }),
  );
  const thin = thinBrief("Camry", five);
  assert.equal(thin.findings.length, 5);
  assert.ok(thin.findings.every((f) => f.confidence === "thin"));
  assert.equal(thin.findings[0].evidenceIds[0], "wikipedia-1");
  assert.equal(thin.findings[0].claim, "Camry note 1");
  assert.match(thin.summary, /Collected 5 live receipts/);

  const six = [
    ...five,
    src({
      id: "wikipedia-6",
      kind: "wikipedia",
      title: "Toyota Camry 6",
      url: "https://en.wikipedia.org/wiki/Toyota_Camry_6",
      snippet: "Camry note 6",
    }),
  ];
  const medium = thinBrief("Camry", six);
  assert.equal(medium.findings.length, 5);
  assert.ok(medium.findings.every((f) => f.confidence === "medium"));
  assert.equal(
    medium.findings.some((f) => f.evidenceIds.includes("wikipedia-6")),
    false,
  );

  const spaces = thinBrief("Camry", [
    src({
      id: "web-1",
      kind: "web",
      title: "Toyota Camry",
      url: "https://en.wikipedia.org/wiki/Toyota_Camry",
      snippet: "   ",
    }),
  ]);
  assert.equal(spaces.findings[0].claim, "   ");
  assert.equal(spaces.findings[0].confidence, "thin");
});

test("sliceResearchPayload rebuilds thin snippet findings when the chosen sense has no matching claims", () => {
  const payload: ResearchPayload = {
    query: "Camry",
    updatedAt: "2026-08-26T00:00:00Z",
    summary: "Collected 1 live receipts for “Camry”.",
    findings: [{ claim: "ghost paper", evidenceIds: ["ghost-1"], confidence: "high" }],
    openQuestions: [],
    angles: [],
    sources: [
      src({
        id: "wikipedia-1",
        kind: "wikipedia",
        title: "Toyota Camry",
        url: "https://en.wikipedia.org/wiki/Toyota_Camry",
        snippet: "The Toyota Camry is a car.",
      }),
    ],
    degraded: [],
    thin: true,
    droppedCount: 0,
    dropped: [],
    senses: [{ id: "sense-camry", label: "Toyota Camry", count: 1, sourceIds: ["wikipedia-1"] }],
    defaultSenseId: "sense-camry",
  };
  const sliced = sliceResearchPayload(payload, "sense-camry");
  assert.equal(sliced.findings.length, 1);
  assert.deepEqual(sliced.findings[0].evidenceIds, ["wikipedia-1"]);
  assert.equal(sliced.findings[0].claim, "The Toyota Camry is a car.");
  assert.equal(sliced.findings[0].confidence, "thin");
  assert.equal(
    sliced.findings.some((f) => f.evidenceIds.includes("ghost-1")),
    false,
  );
});
