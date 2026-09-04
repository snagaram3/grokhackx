import { NextResponse } from "next/server";
import { getAIAgentsStore } from "@/lib/ai-agents-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = getAIAgentsStore();
  const weekly = store.getWeeklyRead();
  const sources = store.getSources();
  const byId = new Map(sources.map((s) => [s.id, s]));

  return NextResponse.json({
    weekly,
    layer: "paid",
    sources: weekly.sections
      .flatMap((s) => s.claims)
      .flatMap((c) => c.sourceIds)
      .map((id) => byId.get(id))
      .filter(Boolean),
  });
}
