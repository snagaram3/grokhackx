import { NextRequest, NextResponse } from "next/server";
import { traceRoots } from "@/lib/insights-roots";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Root-trace: origin extract, parent categories, oldest dated receipt. Not a search ranking. */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const sense = (req.nextUrl.searchParams.get("sense") ?? "").trim() || null;
  if (q.length < 2) {
    return NextResponse.json({ error: "q required" }, { status: 400 });
  }
  try {
    const payload = await traceRoots(q, sense);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[insights]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "insights failed" },
      { status: 502 },
    );
  }
}
