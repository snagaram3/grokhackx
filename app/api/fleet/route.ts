import { NextRequest, NextResponse } from "next/server";
import { validatorAgent } from "@/lib/agents";
import { plugTopicFromPosts } from "@/lib/cluster";
import { asFleetPost, fleetHealth, fleetIngest } from "@/lib/fleet";
import { inferQueryIntent, toQueryInsight } from "@/lib/query";
import { buildSentiment } from "@/lib/sentiment";
import type { Post, TrendsPayload } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type FleetSnap = {
  phrase?: string;
  channels?: string[];
  tools?: string[];
  count?: number;
  posts?: unknown[];
  uri?: string;
  note?: string;
  agent?: string;
};

/** Warm Cloud Run and report whether Footprint ingest is live. Never leaks the URL. */
export async function GET() {
  const health = await fleetHealth();
  return NextResponse.json(health);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { phrase?: string };
  const phrase = (body.phrase ?? "").trim();
  if (phrase.length < 2) {
    return NextResponse.json({ error: "phrase too short" }, { status: 400 });
  }

  const upstream = await fleetIngest(phrase);
  if (!upstream.ok) {
    return NextResponse.json(
      { error: upstream.text, detail: upstream.text.slice(0, 800) },
      { status: upstream.status === 503 || upstream.status === 504 ? upstream.status : 502 },
    );
  }

  let snap: FleetSnap;
  try {
    snap = JSON.parse(upstream.text) as FleetSnap;
  } catch {
    return NextResponse.json({ error: "fleet returned non-JSON" }, { status: 502 });
  }

  const posts = (snap.posts ?? []).map(asFleetPost).filter((p): p is Post => Boolean(p));
  const intent = inferQueryIntent(phrase);
  const clustered = plugTopicFromPosts(phrase, posts, intent);
  const validated = validatorAgent(clustered);
  const lead = validated.topics[0] ?? null;
  const sentiment = lead ? buildSentiment(lead) : null;

  const hn = posts.filter((p) => p.platform === "hn");
  const pub = posts.filter((p) => p.platform === "public");
  const sources = { x: false, reddit: false, hn: hn.length > 0, public: pub.length > 0 };
  const degraded: string[] = [];
  if (!sources.hn) degraded.push("hn offline");
  if (!sources.public) degraded.push("public offline");

  const apis = [...new Set(pub.map((p) => p.sourceApi).filter((n): n is string => Boolean(n)))];
  const payload: TrendsPayload = {
    topics: validated.topics,
    updatedAt: new Date().toISOString(),
    sources,
    degraded,
    pipeline: `fleet ADK ${snap.agent ?? "hawkxai_ingest"} → ${(snap.tools ?? []).join(",")} → ${snap.uri ?? "snapshot"} → ${validated.log}`,
    publicApis: {
      catalog: 3,
      live: apis.length,
      attempted: 3,
      categories: ["Reference", "News", "Vehicle"],
      sources: apis,
      topic: phrase,
    },
    plugged: phrase,
    query: toQueryInsight(intent, validated.topics, sentiment),
  };

  return NextResponse.json(payload);
}
