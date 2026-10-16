import { NextResponse } from "next/server";
import { loadPublicApiCatalog, noAuth } from "@/lib/public-apis";

export const dynamic = "force-dynamic";

/** Catalog allowlist from https://github.com/public-apis/public-apis */
export async function GET() {
  try {
    const catalog = await loadPublicApiCatalog();
    const open = catalog.filter((e) => noAuth(e.auth) && e.https);
    const categories = [...new Set(catalog.map((e) => e.category))];
    return NextResponse.json({
      source: "https://github.com/public-apis/public-apis",
      catalog: catalog.length,
      noAuthHttps: open.length,
      categories,
      entries: open.map((e) => ({
        name: e.name,
        category: e.category,
        url: e.url,
        cors: e.cors,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "catalog failed" },
      { status: 502 },
    );
  }
}
