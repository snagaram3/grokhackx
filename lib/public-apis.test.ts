import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cheapSharkDealsUrl,
  itunesSearchUrl,
  jikanAnimeUrl,
  openAlexUrl,
  parsePublicApisReadme,
  spaceflightNewsUrl,
  stackOverflowUrl,
} from "./public-apis";

const README = `
# Public APIs

### Animals

| API | Description | Auth | HTTPS | CORS |
| :--- | :--- | :--- | :--- | :--- |
| [Dog API](https://dog.ceo) | Dogs as a service | No | Yes | Yes |
| [Cat API](http://cat.test) | Cats | apiKey | No | Unknown |
| [](https://empty.test) | skip nameless | No | Yes | Yes |

Not a table row.

### Cryptocurrency

| [CoinGecko](https://www.coingecko.com) | Coin prices | None | Yes | Yes |
| [Secret Ledger](https://ledger.test) | Needs a key | \`apiKey\` | Yes | No |
`;

test("parsePublicApisReadme reads catalog rows and skips the API header", () => {
  const entries = parsePublicApisReadme(README);
  assert.deepEqual(
    entries.map((e) => e.name),
    ["Dog API", "Cat API", "CoinGecko", "Secret Ledger"],
  );
  const dogs = entries.find((e) => e.name === "Dog API");
  assert.equal(dogs?.url, "https://dog.ceo");
  assert.equal(dogs?.https, true);
  assert.equal(dogs?.auth, "No");
  assert.equal(dogs?.category, "Animals");
  assert.equal(entries.find((e) => e.name === "Cat API")?.https, false);
  assert.equal(entries.find((e) => e.name === "CoinGecko")?.category, "Cryptocurrency");
  assert.equal(entries.find((e) => e.name === "Secret Ledger")?.auth, "`apiKey`");
});

test("parsePublicApisReadme returns empty on prose with no API table", () => {
  assert.deepEqual(parsePublicApisReadme("# Hello\n\nNo tables here.\n"), []);
});

test("spaceflightNewsUrl encodes search and empty omits it at limit=12", () => {
  assert.equal(
    spaceflightNewsUrl("Camry"),
    "https://api.spaceflightnewsapi.net/v4/articles/?limit=12&search=Camry",
  );
  assert.equal(
    spaceflightNewsUrl("  Toyota Camry  "),
    "https://api.spaceflightnewsapi.net/v4/articles/?limit=12&search=Toyota%20Camry",
  );
  const world = spaceflightNewsUrl("  ");
  assert.equal(world, spaceflightNewsUrl(undefined));
  assert.equal(world, "https://api.spaceflightnewsapi.net/v4/articles/?limit=12");
  assert.equal(world.includes("search="), false);
  assert.equal(world.includes("limit=8"), false);
});

test("cheapSharkDealsUrl encodes title; empty is sortBy=Deal%20Rating", () => {
  assert.equal(
    cheapSharkDealsUrl("Camry"),
    "https://www.cheapshark.com/api/1.0/deals?pageSize=10&title=Camry",
  );
  assert.equal(
    cheapSharkDealsUrl("Toyota Camry"),
    "https://www.cheapshark.com/api/1.0/deals?pageSize=10&title=Toyota%20Camry",
  );
  const world = cheapSharkDealsUrl("  ");
  assert.equal(world, cheapSharkDealsUrl(undefined));
  assert.equal(
    world,
    "https://www.cheapshark.com/api/1.0/deals?pageSize=10&sortBy=Deal%20Rating",
  );
  assert.equal(world.includes("title="), false);
  assert.equal(world.includes("Deal+Rating"), false);
  assert.equal(world.includes("pageSize=8"), false);
});

test("jikanAnimeUrl encodes q at limit=10; empty is top/airing", () => {
  assert.equal(
    jikanAnimeUrl("Camry"),
    "https://api.jikan.moe/v4/anime?q=Camry&limit=10",
  );
  assert.equal(
    jikanAnimeUrl("Toyota Camry"),
    "https://api.jikan.moe/v4/anime?q=Toyota%20Camry&limit=10",
  );
  const world = jikanAnimeUrl("  ");
  assert.equal(world, jikanAnimeUrl(undefined));
  assert.equal(world, "https://api.jikan.moe/v4/top/anime?filter=airing&limit=10");
  assert.equal(world.includes("q="), false);
  assert.equal(world.includes("limit=8"), false);
});

test("stackOverflowUrl search is relevance; empty is hot at pagesize=8", () => {
  assert.equal(
    stackOverflowUrl("Camry"),
    "https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=Camry&site=stackoverflow&pagesize=8",
  );
  assert.equal(
    stackOverflowUrl("Toyota Camry"),
    "https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=Toyota%20Camry&site=stackoverflow&pagesize=8",
  );
  const world = stackOverflowUrl("  ");
  assert.equal(world, stackOverflowUrl(undefined));
  assert.equal(
    world,
    "https://api.stackexchange.com/2.3/questions?order=desc&sort=hot&site=stackoverflow&pagesize=8",
  );
  assert.equal(world.includes("search/advanced"), false);
  assert.equal(world.includes("sort=relevance"), false);
  assert.equal(world.includes("pagesize=12"), false);
});

test("openAlexUrl empty defaults to artificial intelligence at per_page=8", () => {
  assert.equal(
    openAlexUrl("Camry"),
    "https://api.openalex.org/works?search=Camry&per_page=8",
  );
  assert.equal(
    openAlexUrl("  Toyota Camry  "),
    "https://api.openalex.org/works?search=Toyota%20Camry&per_page=8",
  );
  const world = openAlexUrl("  ");
  assert.equal(world, openAlexUrl(undefined));
  assert.equal(
    world,
    "https://api.openalex.org/works?search=artificial%20intelligence&per_page=8",
  );
  assert.equal(world.includes("search=&"), false);
  assert.equal(world.includes("per_page=12"), false);
});

test("itunesSearchUrl encodes term, keeps media=all, and limit=8", () => {
  assert.equal(
    itunesSearchUrl("Camry"),
    "https://itunes.apple.com/search?term=Camry&media=all&limit=8",
  );
  assert.equal(
    itunesSearchUrl("  Toyota Camry  "),
    "https://itunes.apple.com/search?term=Toyota%20Camry&media=all&limit=8",
  );
  const url = itunesSearchUrl("Camry");
  assert.equal(url.includes("media=music"), false);
  assert.equal(url.includes("limit=10"), false);
});
