import assert from "node:assert/strict";
import { test } from "node:test";
import {
  duckDuckGoSearchUrl,
  openLibrarySearchUrl,
  openMeteoForecastUrl,
  parsePublicApisReadme,
  sportsDbPastUrl,
  sportsDbSearchUrl,
  tvMazeScheduleUrl,
  tvMazeSearchUrl,
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

test("tvMazeSearchUrl encodes q and does not add a limit", () => {
  assert.equal(tvMazeSearchUrl("Camry"), "https://api.tvmaze.com/search/shows?q=Camry");
  assert.equal(
    tvMazeSearchUrl("  Toyota Camry  "),
    "https://api.tvmaze.com/search/shows?q=Toyota%20Camry",
  );
  const url = tvMazeSearchUrl("Camry");
  assert.equal(url.includes("limit="), false);
  assert.equal(url.includes("per_page="), false);
});

test("tvMazeScheduleUrl encodes country; empty is the web schedule", () => {
  assert.equal(tvMazeScheduleUrl("US"), "https://api.tvmaze.com/schedule?country=US");
  assert.equal(tvMazeScheduleUrl("J P"), "https://api.tvmaze.com/schedule?country=J%20P");
  const world = tvMazeScheduleUrl(null);
  assert.equal(world, tvMazeScheduleUrl(undefined));
  assert.equal(world, tvMazeScheduleUrl(""));
  assert.equal(world, "https://api.tvmaze.com/schedule/web");
  assert.equal(world.includes("country="), false);
});

test("openLibrarySearchUrl encodes q at limit=8", () => {
  assert.equal(
    openLibrarySearchUrl("Camry"),
    "https://openlibrary.org/search.json?q=Camry&limit=8",
  );
  assert.equal(
    openLibrarySearchUrl("  Toyota Camry  "),
    "https://openlibrary.org/search.json?q=Toyota%20Camry&limit=8",
  );
  const url = openLibrarySearchUrl("Camry");
  assert.equal(url.includes("limit=12"), false);
  assert.equal(url.includes("limit=10"), false);
});

test("sportsDbSearchUrl encodes e=; empty world tape is league 4328", () => {
  assert.equal(
    sportsDbSearchUrl("Camry"),
    "https://www.thesportsdb.com/api/v1/json/3/searchevents.php?e=Camry",
  );
  assert.equal(
    sportsDbSearchUrl("  Toyota Camry  "),
    "https://www.thesportsdb.com/api/v1/json/3/searchevents.php?e=Toyota%20Camry",
  );
  assert.equal(
    sportsDbPastUrl(),
    "https://www.thesportsdb.com/api/v1/json/3/eventspastleague.php?id=4328",
  );
  assert.equal(sportsDbPastUrl().includes("searchevents"), false);
  assert.equal(sportsDbSearchUrl("Camry").includes("id=4328"), false);
});

test("duckDuckGoSearchUrl encodes q and does not invent a default topic", () => {
  assert.equal(
    duckDuckGoSearchUrl("Camry"),
    "https://api.duckduckgo.com/?q=Camry&format=json&no_html=1&skip_disambig=1",
  );
  assert.equal(
    duckDuckGoSearchUrl("  Toyota Camry  "),
    "https://api.duckduckgo.com/?q=Toyota%20Camry&format=json&no_html=1&skip_disambig=1",
  );
  const empty = duckDuckGoSearchUrl("  ");
  assert.equal(
    empty,
    "https://api.duckduckgo.com/?q=&format=json&no_html=1&skip_disambig=1",
  );
  assert.equal(empty.includes("artificial"), false);
  assert.equal(empty.includes("skip_disambig=0"), false);
});

test("openMeteoForecastUrl joins lat/lon raw and keeps a negative longitude", () => {
  assert.equal(
    openMeteoForecastUrl([{ lat: 35.68, lon: 139.69 }]),
    "https://api.open-meteo.com/v1/forecast?latitude=35.68&longitude=139.69&current=temperature_2m,weather_code,wind_speed_10m",
  );
  assert.equal(
    openMeteoForecastUrl([
      { lat: 35.68, lon: 139.69 },
      { lat: 40.71, lon: -74.01 },
    ]),
    "https://api.open-meteo.com/v1/forecast?latitude=35.68,40.71&longitude=139.69,-74.01&current=temperature_2m,weather_code,wind_speed_10m",
  );
  const empty = openMeteoForecastUrl([]);
  assert.equal(
    empty,
    "https://api.open-meteo.com/v1/forecast?latitude=&longitude=&current=temperature_2m,weather_code,wind_speed_10m",
  );
  assert.equal(empty.includes("%2C"), false);
  assert.equal(openMeteoForecastUrl([{ lat: 40.71, lon: -74.01 }]).includes("%2D"), false);
});
