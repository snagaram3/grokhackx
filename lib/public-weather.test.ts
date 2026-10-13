import assert from "node:assert/strict";
import { test } from "node:test";
import { mapFrankfurter, mapOpenMeteo } from "./public-apis";

const tokyo = { lat: 35.68, lon: 139.69, label: "Tokyo" };
const london = { lat: 51.51, lon: -0.13, label: "London" };

test("mapOpenMeteo keeps per-location current, always uses the docs URL, and empty current still prints 0°C", () => {
  const posts = mapOpenMeteo(
    [
      {
        current: {
          temperature_2m: 22.4,
          wind_speed_10m: 5.1,
          time: "2026-10-13T10:00",
        },
      },
      { current: {} },
    ],
    [tokyo, london],
  );
  assert.equal(posts.length, 2);
  assert.equal(posts[0].sourceApi, "Open-Meteo");
  assert.equal(posts[0].tool, "collect_public_apis");
  assert.equal(posts[0].title, "Tokyo 22.4°C wind 5.1");
  assert.equal(posts[0].url, "https://open-meteo.com/en/docs#latitude=35.68&longitude=139.69");
  assert.equal(posts[0].score, 40);
  assert.equal(posts[0].createdAt, "2026-10-13T10:00");
  assert.equal(posts[0].geo?.lat, 35.68);
  assert.equal(posts[0].geo?.lon, 139.69);
  assert.equal(posts[1].title, "London 0°C wind 0");
  assert.equal(posts[1].url, "https://open-meteo.com/en/docs#latitude=51.51&longitude=-0.13");
  assert.deepEqual(mapOpenMeteo({ current: { temperature_2m: 18 } }, []), []);
  assert.deepEqual(mapOpenMeteo(null, [tokyo]), []);
  assert.deepEqual(mapOpenMeteo({}, [tokyo]), []);
});

test("mapOpenMeteo drops array temperature on the per-row path then recovers the batched current, and world cap is 12", () => {
  const spots = [
    tokyo,
    london,
    { lat: 19.08, lon: 72.88, label: "Mumbai" },
    { lat: 6.52, lon: 3.38, label: "Lagos" },
    { lat: -23.55, lon: -46.63, label: "São Paulo" },
    { lat: -33.87, lon: 151.21, label: "Sydney" },
    { lat: 30.04, lon: 31.24, label: "Cairo" },
    { lat: 52.52, lon: 13.4, label: "Berlin" },
    { lat: 1.35, lon: 103.82, label: "Singapore" },
  ];
  const temps = [20, 11, 31, 28, 18, 14, 26, 9, 30];
  const batched = mapOpenMeteo(
    {
      current: {
        temperature_2m: temps,
        wind_speed_10m: [3, 4, 5, 6, 7, 8, 9, 10, 11],
        time: ["2026-10-13T10:00", "2026-10-13T09:00"],
      },
    },
    spots,
    12,
  );
  assert.equal(batched.length, 9);
  assert.equal(batched[0].title, "Tokyo 20°C wind 3");
  assert.equal(batched[0].createdAt, "2026-10-13T10:00");
  assert.equal(batched[8].title, "Singapore 30°C wind 11");
  assert.equal(batched[8].url, "https://open-meteo.com/en/docs#latitude=1.35&longitude=103.82");

  const capped = mapOpenMeteo(
    { current: { temperature_2m: temps, wind_speed_10m: temps } },
    spots,
    8,
  );
  assert.equal(capped.length, 8);
  assert.equal(
    capped.some((p) => p.title.startsWith("Singapore")),
    false,
  );

  const scalarWins = mapOpenMeteo(
    { current: { temperature_2m: 16, wind_speed_10m: 2 } },
    spots,
    12,
  );
  assert.equal(scalarWins.length, 1);
  assert.equal(scalarWins[0].title, "Tokyo 16°C wind 2");
});

test("mapFrankfurter always uses frankfurter.app, needs a rates object, and num() junk is 0", () => {
  const posts = mapFrankfurter({ rates: { EUR: 0.92, GBP: 0.78, JPY: "junk" } });
  assert.equal(posts.length, 3);
  assert.equal(posts[0].sourceApi, "Frankfurter");
  assert.equal(posts[0].tool, "collect_public_apis");
  assert.equal(posts[0].title, "USD/EUR 0.92");
  assert.equal(posts[0].url, "https://www.frankfurter.app/");
  assert.equal(posts[0].score, 35);
  assert.equal(posts[1].title, "USD/GBP 0.78");
  assert.equal(posts[2].title, "USD/JPY 0");
  assert.equal(
    posts.every((p) => p.url === "https://www.frankfurter.app/"),
    true,
  );
  assert.deepEqual(mapFrankfurter({ rates: {} }), []);
  assert.deepEqual(mapFrankfurter({ rates: null }), []);
  assert.deepEqual(mapFrankfurter({}), []);
  assert.deepEqual(mapFrankfurter(null), []);
});
