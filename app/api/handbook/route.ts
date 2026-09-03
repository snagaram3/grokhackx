import { NextResponse } from "next/server";
import { buildHandbook, handbookMarkdown } from "@/lib/handbook";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const payload = await buildHandbook();
  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/markdown") || new URL(req.url).searchParams.get("format") === "md") {
    return new NextResponse(handbookMarkdown(payload), {
      headers: { "content-type": "text/markdown; charset=utf-8" },
    });
  }
  return NextResponse.json(payload);
}
