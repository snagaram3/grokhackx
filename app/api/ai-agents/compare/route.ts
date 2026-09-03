import { NextRequest, NextResponse } from "next/server";
import { getAIAgentsStore } from "@/lib/ai-agents-store";
import { compareAgents, generateComparisonMarkdown, parseCompareIds } from "@/lib/ai-agents-compare";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "json";
  const parsed = parseCompareIds(searchParams.get("ids"));

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const ids = parsed.ids;

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
