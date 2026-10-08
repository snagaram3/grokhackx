import assert from "node:assert/strict";
import { test } from "node:test";
import { mapArxivXml, mapUsptoPatents } from "./research";

test("mapArxivXml leftover keeps titled ids, maps relative ids, and drops title-only crumbs", () => {
  const xml = `<?xml version="1.0"?>
<feed>
<entry>
  <id>https://arxiv.org/abs/2401.00001</id>
  <title>Camry crash kinematics</title>
  <summary>A real paper about Camry.</summary>
  <published>2024-01-02T00:00:00Z</published>
</entry>
<entry>
  <id>2401.00002</id>
  <title><![CDATA[Hybrid powertrain notes]]></title>
  <summary>More notes.</summary>
</entry>
<entry>
  <title>Missing id skipped</title>
  <summary>No identifier.</summary>
</entry>
<entry>
  <id>https://arxiv.org/abs/2401.00003</id>
</entry>
</feed>`;
  const sources = mapArxivXml(xml);
  assert.equal(sources.length, 2);
  assert.equal(sources[0]?.id, "arxiv-1");
  assert.equal(sources[0]?.kind, "arxiv");
  assert.equal(sources[0]?.title, "Camry crash kinematics");
  assert.equal(sources[0]?.url, "https://arxiv.org/abs/2401.00001");
  assert.equal(sources[0]?.createdAt, "2024-01-02T00:00:00Z");
  assert.equal(sources[1]?.id, "arxiv-2");
  assert.equal(sources[1]?.url, "https://arxiv.org/abs/2401.00002");
  assert.equal(sources[1]?.title, "Hybrid powertrain notes");
});

test("mapArxivXml leftover empty or non-feed XML does not invent papers", () => {
  assert.deepEqual(mapArxivXml(""), []);
  assert.deepEqual(mapArxivXml("<html>arxiv down</html>"), []);
  assert.deepEqual(mapArxivXml("<feed><title>arxiv</title></feed>"), []);
});

test("mapUsptoPatents leftover keeps numbered titles and drops crumbs instead of inventing a grant", () => {
  const sources = mapUsptoPatents({
    patents: [
      {
        patent_number: "4501234",
        patent_title: "Camry body structure",
        patent_date: "1983-04-01",
        patent_abstract: "A vehicle body.",
      },
      { patent_number: "999", patent_title: "" },
      { patent_title: "No number" },
      { patent_number: "111", patent_title: "Fallback snippet only" },
    ],
  });
  assert.equal(sources.length, 2);
  assert.equal(sources[0]?.id, "uspto-1");
  assert.equal(sources[0]?.kind, "uspto");
  assert.equal(sources[0]?.title, "Camry body structure");
  assert.equal(sources[0]?.url, "https://patents.google.com/patent/US4501234");
  assert.equal(sources[0]?.snippet, "A vehicle body.");
  assert.equal(sources[0]?.createdAt, "1983-04-01");
  assert.equal(sources[1]?.url, "https://patents.google.com/patent/US111");
  assert.match(sources[1]?.snippet ?? "", /USPTO 111/);
});

test("mapUsptoPatents leftover junk is empty and does not invent patents", () => {
  assert.deepEqual(mapUsptoPatents(null), []);
  assert.deepEqual(mapUsptoPatents({}), []);
  assert.deepEqual(mapUsptoPatents({ patents: { patent_number: "1", patent_title: "x" } }), []);
});
