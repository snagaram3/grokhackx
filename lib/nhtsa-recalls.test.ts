import assert from "node:assert/strict";
import { test } from "node:test";
import { mapNhtsaRecalls } from "./public-apis";

test("mapNhtsaRecalls leftover campaign id uses nhtsaId and missing id stays on /recalls", () => {
  const posts = mapNhtsaRecalls({
    results: [
      {
        NHTSACampaignNumber: "24V-100",
        Component: "AIR BAGS",
        Manufacturer: "Toyota Motor Corporation",
        ReportReceivedDate: "2024-02-01",
      },
      {
        Component: "FUEL SYSTEM",
        Manufacturer: "Toyota Motor Corporation",
      },
      { NHTSACampaignNumber: "", Component: "", Manufacturer: "" },
    ],
  });
  assert.equal(posts.length, 2);
  assert.equal(posts[0]?.title, "Recall 24V-100 · AIR BAGS · Toyota Motor Corporation");
  assert.equal(posts[0]?.url, "https://www.nhtsa.gov/recalls?nhtsaId=24V-100");
  assert.equal(posts[0]?.sourceApi, "NHTSA");
  assert.equal(posts[0]?.tool, "collect_public_apis");
  assert.equal(posts[0]?.createdAt, "2024-02-01");
  assert.equal(posts[1]?.title, "FUEL SYSTEM · Toyota Motor Corporation");
  assert.equal(posts[1]?.url, "https://www.nhtsa.gov/recalls");
});

test("mapNhtsaRecalls leftover junk is empty and caps at eight recalls", () => {
  assert.deepEqual(mapNhtsaRecalls(null), []);
  assert.deepEqual(mapNhtsaRecalls({}), []);
  assert.deepEqual(mapNhtsaRecalls({ results: { NHTSACampaignNumber: "24V-1" } }), []);

  const many = mapNhtsaRecalls({
    results: Array.from({ length: 12 }, (_, i) => ({
      NHTSACampaignNumber: `24V-${i}`,
      Component: "AIR BAGS",
    })),
  });
  assert.equal(many.length, 8);
  assert.equal(many[0]?.title, "Recall 24V-0 · AIR BAGS");
  assert.equal(many[7]?.title, "Recall 24V-7 · AIR BAGS");
});
