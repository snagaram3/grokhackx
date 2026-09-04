import { NextRequest, NextResponse } from "next/server";
import { getAIAgentsStore } from "@/lib/ai-agents-store";

export const dynamic = "force-dynamic";

/** Trace any on-screen metric back to raw source receipts. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId") || undefined;
  const metric = searchParams.get("metric") || undefined;
  const sourceId = searchParams.get("id") || undefined;

  const store = getAIAgentsStore();
  let sources = store.getSources(agentId);

  if (sourceId) {
    sources = sources.filter((s) => s.id === sourceId);
  }
  if (metric) {
    sources = sources.filter((s) => s.metric === metric || metric === "all");
  }

  return NextResponse.json({
    agentId: agentId || null,
    metric: metric || null,
    count: sources.length,
    sources,
    disclaimer:
      "These receipts are public discourse signals (attention), not adoption. Every dashboard number links here.",
  });
}
