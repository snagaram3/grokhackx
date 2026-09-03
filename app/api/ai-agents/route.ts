import { NextRequest, NextResponse } from "next/server";
import { getAIAgentsStore, parseAgentFilter } from "@/lib/ai-agents-store";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filter = parseAgentFilter({
    category: searchParams.get("category"),
    provider: searchParams.get("provider"),
    trending: searchParams.get("trending"),
    minMentions: searchParams.get("minMentions"),
    pricingTier: searchParams.get("pricingTier"),
  });

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
