import assert from "node:assert/strict";
import { test } from "node:test";
import {
  coinGeckoSearchUrl,
  devToArticlesUrl,
  federalRegisterUrl,
  githubSearchUrl,
  nhtsaRecallsUrl,
  parsePublicApisReadme,
  reliefWebUrl,
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

test("coinGeckoSearchUrl encodes the query and trims", () => {
  assert.equal(
    coinGeckoSearchUrl("Camry"),
    "https://api.coingecko.com/api/v3/search?query=Camry",
  );
  assert.equal(
    coinGeckoSearchUrl("  Toyota Camry  "),
    "https://api.coingecko.com/api/v3/search?query=Toyota%20Camry",
  );
});

test("githubSearchUrl encodes q, sorts by updated, and keeps per_page=8", () => {
  assert.equal(
    githubSearchUrl("Camry"),
    "https://api.github.com/search/repositories?q=Camry&sort=updated&per_page=8",
  );
  assert.equal(
    githubSearchUrl("Toyota Camry"),
    "https://api.github.com/search/repositories?q=Toyota%20Camry&sort=updated&per_page=8",
  );
  const url = githubSearchUrl("Camry");
  assert.equal(url.includes("sort=stars"), false);
  assert.equal(url.includes("per_page=12"), false);
});

test("devToArticlesUrl uses the first token as tag and empty is top=1 at per_page=12", () => {
  assert.equal(
    devToArticlesUrl("Camry"),
    "https://dev.to/api/articles?per_page=12&tag=camry",
  );
  assert.equal(
    devToArticlesUrl("  Toyota Camry  "),
    "https://dev.to/api/articles?per_page=12&tag=toyota",
  );
  assert.equal(
    devToArticlesUrl("#Camry"),
    "https://dev.to/api/articles?per_page=12&tag=%23camry",
  );
  const world = devToArticlesUrl("  ");
  assert.equal(world, devToArticlesUrl(undefined));
  assert.equal(world, "https://dev.to/api/articles?per_page=12&top=1");
  assert.equal(world.includes("tag="), false);
  assert.equal(world.includes("per_page=8"), false);
});

test("reliefWebUrl encodes query[value] and keeps unencoded sort[] / brackets", () => {
  const camry = reliefWebUrl("Camry");
  assert.equal(
    camry,
    "https://api.reliefweb.int/v1/reports?appname=hawkxai&limit=8&sort[]=date:desc&query[value]=Camry",
  );
  assert.match(reliefWebUrl("Toyota Camry"), /query\[value\]=Toyota%20Camry/);
  const world = reliefWebUrl("  ");
  assert.equal(world, reliefWebUrl(undefined));
  assert.equal(
    world,
    "https://api.reliefweb.int/v1/reports?appname=hawkxai&limit=8&sort[]=date:desc",
  );
  assert.equal(world.includes("query[value]"), false);
  assert.equal(camry.includes("sort%5B%5D"), false);
  assert.equal(camry.includes("query%5Bvalue%5D"), false);
  assert.equal(camry.includes("date%3Adesc"), false);
  assert.equal(camry.includes("limit=12"), false);
});

test("federalRegisterUrl encodes conditions[term]; empty is order=newest without a term", () => {
  const camry = federalRegisterUrl("Camry");
  assert.equal(
    camry,
    "https://www.federalregister.gov/api/v1/documents.json?conditions[term]=Camry&per_page=8",
  );
  assert.match(federalRegisterUrl("Toyota Camry"), /conditions\[term\]=Toyota%20Camry/);
  const world = federalRegisterUrl("  ");
  assert.equal(world, federalRegisterUrl(undefined));
  assert.equal(
    world,
    "https://www.federalregister.gov/api/v1/documents.json?per_page=8&order=newest",
  );
  assert.equal(world.includes("conditions[term]"), false);
  assert.equal(camry.includes("order=newest"), false);
  assert.equal(camry.includes("conditions%5Bterm%5D"), false);
  assert.equal(camry.includes("per_page=12"), false);
});

test("nhtsaRecallsUrl encodes make, model, and modelYear", () => {
  assert.equal(
    nhtsaRecallsUrl("toyota", "camry", "2024"),
    "https://api.nhtsa.gov/recalls/recallsByVehicle?make=toyota&model=camry&modelYear=2024",
  );
  assert.equal(
    nhtsaRecallsUrl("land rover", "range rover", "2024+"),
    "https://api.nhtsa.gov/recalls/recallsByVehicle?make=land%20rover&model=range%20rover&modelYear=2024%2B",
  );
});
