import assert from "node:assert/strict";
import { test } from "node:test";
import {
  filterTrendItems,
  isGoogleTrendsUrl,
  parseTrendsRss,
  trendsRssGeos,
} from "./signals";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:ht="https://trends.google.com/trends/trendingsearches/daily" version="2.0">
  <channel>
    <item>
      <title>Camry</title>
      <ht:approx_traffic>200000+</ht:approx_traffic>
      <link>https://trends.google.com/trending/explore?q=Camry&amp;geo=US</link>
    </item>
    <item>
      <title>WWDC</title>
      <link href="https://trends.google.com/trending/explore?q=WWDC&amp;geo=US" />
    </item>
    <item>
      <title>Missing link skipped</title>
    </item>
  </channel>
</rss>`;

test("isGoogleTrendsUrl accepts trends hosts only", () => {
  assert.equal(isGoogleTrendsUrl("https://trends.google.com/trending/rss?geo=US"), true);
  assert.equal(isGoogleTrendsUrl("https://www.google.com/trends/explore?q=Camry"), true);
  assert.equal(isGoogleTrendsUrl("https://x.com/camry"), false);
  assert.equal(isGoogleTrendsUrl("not a url"), false);
});

test("parseTrendsRss keeps retrieved hrefs and skips items without a URL", () => {
  const items = parseTrendsRss(SAMPLE);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "Camry");
  assert.equal(items[0].url, "https://trends.google.com/trending/explore?q=Camry&geo=US");
  assert.equal(items[0].score, 100);
  assert.equal(items[1].title, "WWDC");
  assert.equal(items[1].score, 77);
});

test("parseTrendsRss decodes CDATA, uses news_item_url, and scores missing traffic by rank", () => {
  assert.deepEqual(parseTrendsRss("<rss></rss>"), []);
  const items = parseTrendsRss(`<?xml version="1.0"?>
<rss xmlns:ht="https://trends.google.com/trends/trendingsearches/daily">
  <channel>
    <item>
      <title><![CDATA[Civic &amp; Accord]]></title>
      <ht:news_item_url>https://news.test/civic</ht:news_item_url>
    </item>
    <item>
      <title>Zero traffic</title>
      <ht:approx_traffic>0+</ht:approx_traffic>
      <link>https://trends.google.com/trending/explore?q=Zero</link>
    </item>
  </channel>
</rss>`);
  assert.equal(items[0].title, "Civic & Accord");
  assert.equal(items[0].url, "https://news.test/civic");
  assert.equal(items[0].score, 80);
  assert.equal(items[1].score, 77);
});

test("filterTrendItems keeps only phrase hits and dedupes URLs", () => {
  const items = parseTrendsRss(SAMPLE);
  const camry = filterTrendItems(items, "Camry");
  assert.equal(camry.length, 1);
  assert.equal(camry[0].title, "Camry");
  const world = filterTrendItems(items);
  assert.equal(world.length, 2);
  const duped = filterTrendItems([...items, items[0]]);
  assert.equal(duped.length, 2);
});

test("trendsRssGeos uses the city YouTube region, world uses five geos", () => {
  assert.deepEqual(trendsRssGeos("tokyo"), ["JP"]);
  assert.equal(trendsRssGeos("all").length, 5);
});
