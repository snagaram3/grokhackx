import assert from "node:assert/strict";
import { test } from "node:test";
import { tokenHits } from "./phrase-hit";
import { floorLine, inferQueryIntent, searchQuery, titleHits, titleScore } from "./query";

test("tokenHits keeps Camry a whole token", () => {
  assert.equal(tokenHits("New Camry hybrid", "Camry"), true);
  assert.equal(tokenHits("Toyota Camry, 2002 Thru 2006", "Camry"), true);
  assert.equal(tokenHits("camera sensor", "Camry"), false);
  assert.equal(tokenHits("GitHub: cmblum2/camryn-portfolio", "Camry"), false);
  assert.equal(tokenHits("https://github.com/mcfadyentheresa-lab/4Camryn", "Camry"), false);
  assert.equal(tokenHits("heat https://x.test/#HeatWaveFit", "#HeatWaveFit"), true);
});

test("titleScore does not boost camryn occupiers for Camry", () => {
  assert.ok(titleScore("Toyota Camry automotive repair manual", ["camry", "toyota camry"]) >= 1.6);
  assert.ok(titleHits("Toyota Camry automotive repair manual", ["camry"]));
  assert.equal(titleHits("GitHub: cmblum2/camryn-portfolio", ["camry"]), false);
  assert.ok(titleScore("GitHub: cmblum2/camryn-portfolio", ["camry"]) < 1.4);
});

test("inferQueryIntent classifies ticker, hashtag, campaign, product, and recall", () => {
  const ticker = inferQueryIntent(" $TSLA ");
  assert.equal(ticker.kind, "ticker");
  assert.equal(ticker.category, "markets");
  assert.ok(ticker.aliases.includes("TSLA"));

  const tag = inferQueryIntent("#HeatWaveFit drop");
  assert.equal(tag.kind, "hashtag");
  assert.equal(tag.category, "campaigns");

  const campaign = inferQueryIntent("scan this qr https://qrco.de/heat");
  assert.equal(campaign.kind, "campaign");
  assert.equal(campaign.category, "campaigns");

  const product = inferQueryIntent("Camry");
  assert.equal(product.kind, "product");
  assert.equal(product.category, "markets");
  assert.ok(product.aliases.some((a) => a.toLowerCase().includes("toyota")));

  const recall = inferQueryIntent("Camry recall");
  assert.equal(recall.kind, "event");
  assert.equal(recall.category, "news");

  const generic = inferQueryIntent("blorptastic");
  assert.equal(generic.kind, "generic");
  assert.equal(generic.category, "culture");
});

test("inferQueryIntent leftover products stay markets; event words stay campaigns unless risk language", () => {
  const civic = inferQueryIntent("Civic");
  assert.equal(civic.kind, "product");
  assert.equal(civic.category, "markets");
  assert.ok(civic.aliases.some((a) => a.toLowerCase().includes("honda")));

  const tesla = inferQueryIntent("Tesla");
  assert.equal(tesla.kind, "product");
  assert.equal(tesla.category, "markets");
  assert.ok(tesla.aliases.some((a) => a.toLowerCase() === "tsla"));

  const mustang = inferQueryIntent("Mustang");
  assert.equal(mustang.kind, "product");
  assert.equal(mustang.category, "markets");

  const ces = inferQueryIntent("CES keynote");
  assert.equal(ces.kind, "event");
  assert.equal(ces.category, "campaigns");

  const bowl = inferQueryIntent("Super Bowl");
  assert.equal(bowl.kind, "event");
  assert.equal(bowl.category, "campaigns");

  const earnings = inferQueryIntent("earnings");
  assert.equal(earnings.kind, "event");
  assert.equal(earnings.category, "campaigns");

  const lawsuit = inferQueryIntent("launch lawsuit");
  assert.equal(lawsuit.kind, "event");
  assert.equal(lawsuit.category, "news");

  const ban = inferQueryIntent("earnings ban");
  assert.equal(ban.kind, "event");
  assert.equal(ban.category, "news");
});

test("searchQuery quotes multi-word aliases and floorLine refuses invented reach", () => {
  assert.equal(searchQuery({ raw: "Camry", aliases: [] }), "Camry");
  assert.ok(searchQuery({ raw: "Camry", aliases: ["Toyota Camry"] }).includes('"Toyota Camry"'));
  const intent = inferQueryIntent("Camry");
  assert.match(floorLine(intent, null, 0, "neighbor"), /No exact print/);
  assert.match(floorLine(intent, null, 3, "neighbor"), /Not an exact match/);
  assert.match(
    floorLine(
      intent,
      {
        topicId: "camry",
        lean: "thin",
        overall: { pos: 0, neg: 0, risk: 0, n: 1 },
        byPlatform: {},
        drivers: [],
        quotes: [],
        hits: [],
        thin: true,
      },
      4,
      "exact",
    ),
    /thin/,
  );
});
