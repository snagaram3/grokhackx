import type { Post } from "./types";

export interface FleetHealth {
  configured: boolean;
  ok: boolean;
  ms: number;
}

/** Drop junk ADK snapshot rows. Never invent a platform, title, or URL. */
export function asFleetPost(raw: unknown): Post | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const platform = p.platform;
  if (platform !== "hn" && platform !== "public" && platform !== "reddit" && platform !== "x") {
    return null;
  }
  const title = String(p.title ?? "").trim();
  const url = String(p.url ?? "").trim();
  if (!title || !url) return null;
  const post: Post = {
    platform,
    title,
    url,
    score: Number(p.score) || 0,
    createdAt: String(p.createdAt ?? ""),
  };
  const parsed = Date.parse(post.createdAt);
  if (Number.isNaN(parsed)) post.createdAt = "";
  else post.createdAt = new Date(parsed).toISOString();
  if (typeof p.sourceApi === "string" && p.sourceApi) post.sourceApi = p.sourceApi;
  if (typeof p.tool === "string" && p.tool) post.tool = p.tool;
  if (typeof p.collectedAt === "string" && p.collectedAt) post.collectedAt = p.collectedAt;
  return post;
}

export function fleetBaseUrl(): string {
  return (process.env.FLEET_URL ?? "").replace(/\/$/, "");
}

export async function fleetHealth(timeoutMs = 4000): Promise<FleetHealth> {
  const base = fleetBaseUrl();
  if (!base) return { configured: false, ok: false, ms: 0 };
  const t0 = Date.now();
  try {
    const res = await fetch(`${base}/health`, {
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    return { configured: true, ok: res.ok, ms: Date.now() - t0 };
  } catch {
    return { configured: true, ok: false, ms: Date.now() - t0 };
  }
}

export async function fleetIngest(
  phrase: string,
  timeoutMs = 20_000,
): Promise<{ ok: boolean; status: number; text: string }> {
  const base = fleetBaseUrl();
  if (!base) {
    return { ok: false, status: 503, text: "FLEET_URL missing — Footprint ingest needs the Cloud Run fleet" };
  }
  try {
    const res = await fetch(`${base}/v1/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phrase }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    return { ok: res.ok, status: res.status, text: await res.text() };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return {
      ok: false,
      status: timedOut ? 504 : 503,
      text: timedOut ? "fleet ingest timed out" : "fleet unreachable",
    };
  }
}

export function fleetChip(health: FleetHealth | null): string | null {
  if (!health) return null;
  if (health.ok) return "Fleet ready";
  if (health.configured) return "Fleet offline · live tape";
  return "Fleet unset · live tape";
}
