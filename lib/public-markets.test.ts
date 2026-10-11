import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mapCoinCap,
  mapCoinGeckoSearch,
  mapCoinGeckoTrending,
  mapFearGreed,
} from "./public-apis";

test("mapCoinGeckoSearch keeps titled coins, invents a slug from the name when id misses, and slices raw rows to 8 before dropping empties", () => {
  const posts = mapCoinGeckoSearch({
    coins: [
      { id: "bitcoin", name: "Bitcoin", symbol: "btc" },
      { name: "NoId Coin", symbol: "nid" },
      { id: "ghost", symbol: "gh" },
      ...Array.from({ length: 8 }, () => ({ id: "empty" })),
      { id: "camry-coin", name: "Camry Coin", symbol: "cam" },
    ],
  });
  assert.equal(posts.length, 2);
  assert.equal(posts[0].sourceApi, "CoinGecko");
  assert.equal(posts[0].tool, "collect_public_apis");
  assert.equal(posts[0].title, "Bitcoin ($BTC)");
  assert.equal(posts[0].url, "https://www.coingecko.com/en/coins/bitcoin");
  assert.equal(posts[0].score, 85);
  assert.equal(posts[1].title, "NoId Coin ($NID)");
  assert.equal(posts[1].url, "https://www.coingecko.com/en/coins/NoId Coin");
  assert.equal(posts[1].score, 80);
  assert.equal(
    posts.some((p) => p.url.includes("camry-coin") || p.url.includes("ghost")),
    false,
  );
  assert.deepEqual(mapCoinGeckoSearch({}), []);
  assert.deepEqual(mapCoinGeckoSearch({ coins: {} }), []);
});

test("mapCoinGeckoTrending suffixes trending, uses the name as a coin slug when id misses, and caps 8 after filter", () => {
  const posts = mapCoinGeckoTrending({
    coins: [
      ...Array.from({ length: 8 }, () => ({ item: { id: "empty" } })),
      { item: { id: "solana", name: "Solana", symbol: "sol", score: 2 } },
      { item: { name: "NoId Trend", symbol: "nit", score: 0 } },
    ],
  });
  assert.equal(posts.length, 2);
  assert.equal(posts[0].title, "Solana ($SOL) trending");
  assert.equal(posts[0].url, "https://www.coingecko.com/en/coins/solana");
  assert.equal(posts[0].score, 82);
  assert.equal(posts[0].sourceApi, "CoinGecko");
  assert.equal(posts[1].title, "NoId Trend ($NIT) trending");
  assert.equal(posts[1].url, "https://www.coingecko.com/en/coins/NoId Trend");
  assert.deepEqual(mapCoinGeckoTrending({ coins: [{ item: {} }] }), []);
  assert.deepEqual(mapCoinGeckoTrending(null), []);
});

test("mapCoinCap topic miss falls back to the world tape, empty id stays /assets/, and missing name drops", () => {
  const tape = {
    data: [
      { id: "bitcoin", name: "Bitcoin", symbol: "BTC", priceUsd: "68000.129", changePercent24Hr: "2.4" },
      { id: "", name: "NoId Asset", symbol: "nid", priceUsd: "1", changePercent24Hr: "-5" },
      { id: "ghost", symbol: "gh", priceUsd: "3", changePercent24Hr: "1" },
    ],
  };
  const hit = mapCoinCap(tape, "bitcoin");
  assert.equal(hit.length, 1);
  assert.equal(hit[0].title, "Bitcoin $68000.13 (2.4%)");
  assert.equal(hit[0].url, "https://coincap.io/assets/bitcoin");
  assert.equal(hit[0].score, 39);
  assert.equal(hit[0].sourceApi, "CoinCap");

  const miss = mapCoinCap(tape, "Camry");
  assert.equal(miss.length, 2);
  assert.equal(miss[0].url, "https://coincap.io/assets/bitcoin");
  assert.equal(miss[1].title, "NoId Asset $1.00 (-5.0%)");
  assert.equal(miss[1].url, "https://coincap.io/assets/");
  assert.equal(miss[1].score, 60);
  assert.equal(
    miss.some((p) => p.url.includes("ghost")),
    false,
  );

  assert.deepEqual(mapCoinCap({}), []);
  assert.deepEqual(mapCoinCap({ data: {} }), []);
});

test("mapFearGreed needs a value or a label, always uses the Alternative.me index URL, and floors the score at 20", () => {
  const hit = mapFearGreed({
    data: [{ value: "80", value_classification: "Extreme Greed" }],
  });
  assert.equal(hit.length, 1);
  assert.equal(hit[0].title, "Crypto Fear & Greed Extreme Greed (80)");
  assert.equal(hit[0].url, "https://alternative.me/crypto/fear-and-greed-index/");
  assert.equal(hit[0].score, 80);
  assert.equal(hit[0].sourceApi, "Fear & Greed");

  const low = mapFearGreed({ data: [{ value: "5", value_classification: "Extreme Fear" }] });
  assert.equal(low[0].score, 20);

  const valueOnly = mapFearGreed({ data: [{ value: "40" }] });
  assert.equal(valueOnly[0].title, "Crypto Fear & Greed  (40)");
  const labelOnly = mapFearGreed({ data: [{ value_classification: "Neutral" }] });
  assert.equal(labelOnly[0].title, "Crypto Fear & Greed Neutral ()");

  assert.deepEqual(mapFearGreed({ data: [{}] }), []);
  assert.deepEqual(mapFearGreed({}), []);
  assert.deepEqual(mapFearGreed(null), []);
});
