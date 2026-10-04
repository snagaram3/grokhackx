import { NextResponse } from "next/server";
import { buildHandbook, handbookMarkdown, handbookWantsMarkdown } from "@/lib/handbook";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const payload = await buildHandbook();
  if (handbookWantsMarkdown(req)) {
    return new NextResponse(handbookMarkdown(payload), {
      headers: { "content-type": "text/markdown; charset=utf-8" },
    });
  }
  return NextResponse.json(payload);
}
