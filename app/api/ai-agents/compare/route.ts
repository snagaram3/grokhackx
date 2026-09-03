import { NextRequest, NextResponse } from "next/server";
import { getAIAgentsStore } from "@/lib/ai-agents-store";
import { compareAgents, generateComparisonMarkdown } from "@/lib/ai-agents-compare";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const idsParam = searchParams.get("ids");
  const format = searchParams.get("format") || "json";
  
  if (!idsParam) {
    return NextResponse.json(
      { error: "Missing 'ids' parameter. Provide comma-separated agent IDs." },
      { status: 400 }
    );
  }

  const ids = idsParam.split(",").map((id) => id.trim()).filter(Boolean);
  
  if (ids.length < 2) {
    return NextResponse.json(
      { error: "At least 2 agent IDs required for comparison" },
      { status: 400 }
    );
  }

  if (ids.length > 6) {
    return NextResponse.json(
      { error: "Maximum 6 agents can be compared at once" },
      { status: 400 }
    );
  }

  try {
    const store = getAIAgentsStore();
    const agents = ids.map((id) => store.getById(id)).filter((a): a is NonNullable<typeof a> => a !== undefined);
    
    if (agents.length !== ids.length) {
      const foundIds = agents.map((a) => a.id);
      const notFound = ids.filter((id) => !foundIds.includes(id));
      return NextResponse.json(
        { error: `Agents not found: ${notFound.join(", ")}` },
        { status: 404 }
      );
    }

    const comparison = compareAgents(agents);

    if (format === "markdown") {
      const markdown = generateComparisonMarkdown(comparison);
      return new NextResponse(markdown, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
        },
      });
    }

    return NextResponse.json(comparison);
  } catch (error) {
    console.error("[ai-agents-compare] Error:", error);
    return NextResponse.json(
      { error: "Failed to compare agents" },
      { status: 500 }
    );
  }
}
