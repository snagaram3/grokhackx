import { NextRequest, NextResponse } from "next/server";
import { getAIAgentsStore } from "@/lib/ai-agents-store";
import type { AIAgentCategory, AIAgentFilter, AIAgentProvider } from "@/lib/ai-agents-types";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const filter: AIAgentFilter = {};
  
  const category = searchParams.get("category");
  if (category) {
    filter.category = category as AIAgentCategory;
  }
  
  const provider = searchParams.get("provider");
  if (provider) {
    filter.provider = provider as AIAgentProvider;
  }
  
  const trending = searchParams.get("trending");
  if (trending !== null) {
    filter.trending = trending === "true";
  }
  
  const minMentions = searchParams.get("minMentions");
  if (minMentions) {
    filter.minMentions = parseInt(minMentions, 10);
  }
  
  const pricingTier = searchParams.get("pricingTier");
  if (pricingTier) {
    filter.pricingTier = pricingTier as AIAgentFilter["pricingTier"];
  }

  const refresh = searchParams.get("refresh");
  
  try {
    const store = getAIAgentsStore();
    
    if (refresh === "true") {
      store.refresh();
    }
    
    const payload = store.getPayload(filter);
    const agents = payload.agents;
    const insights = store.generateInsights(agents);
    
    return NextResponse.json({
      ...payload,
      insights,
    });
  } catch (error) {
    console.error("[ai-agents] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI agents data" },
      { status: 500 }
    );
  }
}
