import { NextRequest, NextResponse } from "next/server";
import { cachePeek } from "@/lib/cache";
import { asCategory, collectAndForecast } from "@/lib/collect";
import { cronAuthorized, requestOrigin, runHourlyCollect } from "@/lib/hourly-collect";
import { allDatabaseNames, readTrendDbConfig } from "@/lib/trend-db";
import { trendStore } from "@/lib/trend-store";
import type { BoosterPayload, TrendsPayload } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("hourly") === "1") {
    if (!cronAuthorized(req)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const result = await runHourlyCollect(requestOrigin(req));
    return NextResponse.json(result);
  }

  const store = trendStore();
  const configured = Boolean(readTrendDbConfig());
  const category = asCategory(req.nextUrl.searchParams.get("category"));
  const trends = cachePeek<TrendsPayload>("trends:v1");
  const booster = cachePeek<BoosterPayload>("booster:v1");
  if (!trends) {
    return NextResponse.json({
      backend: store.backend,
      configured,
      databases: allDatabaseNames(),
      snapshots: await store.snapshotCount().catch(() => 0),
      waiting: "Load GET /api/trends first so collection has a tape.",
    });
  }

  const result = await collectAndForecast(trends, booster?.briefs ?? [], category);
  return NextResponse.json({
    backend: result.collection.backend,
    configured,
    databases: result.collection.databases,
    snapshots: result.collection.snapshots,
    predicted: result.collection.predicted,
    history: result.collection.history ?? [],
    category,
    forecasts: result.forecasts,
  });
}
