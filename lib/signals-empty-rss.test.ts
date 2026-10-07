import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTrendsRss } from "./signals";

test("parseTrendsRss returns empty on non-RSS and does not throw", () => {
  assert.deepEqual(parseTrendsRss(""), []);
  assert.deepEqual(parseTrendsRss("<html>trends unavailable</html>"), []);
  assert.deepEqual(
    parseTrendsRss(`<?xml version="1.0"?><rss version="2.0"><channel><title>Trends</title></channel></rss>`),
    [],
  );
});

test("parseTrendsRss drops ftp hrefs and title-only crumbs instead of inventing a Trends URL", () => {
  const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Camry</title>
      <link>ftp://files.test/camry</link>
    </item>
    <item>
      <title>WWDC</title>
    </item>
  </channel>
</rss>`;
  assert.deepEqual(parseTrendsRss(xml), []);
});
