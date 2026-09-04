import { NextRequest, NextResponse } from "next/server";
import { getAIAgentsStore } from "@/lib/ai-agents-store";
import type {
  AIAgentCategory,
  AIAgentFilter,
  AIAgentProvider,
  AIAgentSort,
  ProductLayer,
} from "@/lib/ai-agents-types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const filter: AIAgentFilter = {};

  const category = searchParams.get("category");
  if (category) filter.category = category as AIAgentCategory;

  const provider = searchParams.get("provider");
  if (provider) filter.provider = provider as AIAgentProvider;

  const trending = searchParams.get("trending");
  if (trending !== null) filter.trending = trending === "true";

  const minMentions = searchParams.get("minMentions");
  if (minMentions) filter.minMentions = parseInt(minMentions, 10);

  const minRoc = searchParams.get("minRoc") || searchParams.get("minRateOfChange");
  if (minRoc) filter.minRateOfChange = parseFloat(minRoc);

  const pricingTier = searchParams.get("pricingTier");
  if (pricingTier) filter.pricingTier = pricingTier as AIAgentFilter["pricingTier"];

  const sort = searchParams.get("sort") as AIAgentSort | null;
  if (sort) filter.sort = sort;

  const layer: ProductLayer = searchParams.get("layer") === "paid" ? "paid" : "free";
  const refresh = searchParams.get("refresh");
  const live = searchParams.get("live");

  try {
    const store = getAIAgentsStore();

    if (refresh === "true") {
      store.refresh();
    }
    if (live === "true") {
      await store.refreshLive();
    }

    const payload = store.getPayload(filter, layer);
    const insights = store.generateInsights(payload.agents);

    return NextResponse.json({
      ...payload,
      insights,
    });
  } catch (error) {
    console.error("[ai-agents] Error:", error);
    // Last-resort seeded fallback — never empty
    try {
      const store = getAIAgentsStore();
      store.refresh();
      const payload = store.getPayload(filter, layer);
      return NextResponse.json({
        ...payload,
        insights: store.generateInsights(payload.agents),
        degraded: true,
      });
    } catch {
      return NextResponse.json({ error: "Failed to fetch AI agents data" }, { status: 500 });
    }
  }
}
