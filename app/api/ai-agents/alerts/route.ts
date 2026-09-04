import { NextResponse } from "next/server";
import { getAIAgentsStore } from "@/lib/ai-agents-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = getAIAgentsStore();
  const alerts = store.getAlerts();
  const sources = store.getSources();
  const byId = new Map(sources.map((s) => [s.id, s]));

  return NextResponse.json({
    alerts,
    layer: "paid",
    count: alerts.length,
    sources: alerts
      .flatMap((a) => a.sourceIds)
      .map((id) => byId.get(id))
      .filter(Boolean),
  });
}
