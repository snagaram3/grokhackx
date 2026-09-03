import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FLEET_GRAPH, LINEAGE_GRAPH, ML_GRAPH } from "./architecture-diagrams";
import { MODEL_CARD } from "./histgb";
import type { HandbookPayload, HandbookPermissions, PermissionChange } from "./handbook-types";
import { HANDBOOK_FLOORS } from "./handbook-types";
import { readModelBlob, writeModelBlob } from "./watchlist-store";

function loadPermissions(): HandbookPayload["permissions"] {
  try {
    const raw = readFileSync(join(process.cwd(), "fleet", "permissions.json"), "utf8");
    return JSON.parse(raw) as HandbookPayload["permissions"];
  } catch {
    return { tools: {} };
  }
}

export function diffPermissions(
  prev: HandbookPermissions | null,
  current: HandbookPermissions,
): { summary: string; changes: PermissionChange[] } {
  const tools = new Set([
    ...Object.keys(prev?.tools ?? {}),
    ...Object.keys(current.tools ?? {}),
  ]);
  const changes: PermissionChange[] = [];
  if (!prev) {
    return { summary: "No previous render. This pass is the baseline.", changes };
  }
  for (const tool of [...tools].toSorted()) {
    const before = Boolean((prev.tools ?? {})[tool]?.enabled);
    const after = Boolean((current.tools ?? {})[tool]?.enabled);
    if (before !== after) {
      changes.push({ tool, from: before ? "on" : "off", to: after ? "on" : "off" });
    }
  }
  if (!changes.length) {
    return { summary: "No change since last handbook render.", changes };
  }
  return {
    summary: `${changes.length} tool${changes.length === 1 ? "" : "s"} flipped.`,
    changes,
  };
}

export async function buildHandbook(): Promise<HandbookPayload> {
  const permissions = loadPermissions();
  const prev = (await readModelBlob("handbook_permissions")) as HandbookPermissions | null;
  const permissionDiff = diffPermissions(prev, permissions);
  await writeModelBlob("handbook_permissions", permissions);
  return {
    generatedAt: new Date().toISOString(),
    product: [
      "HawkxAI live desk: Trends / Watch / Footprint / Insights / Research.",
      "Contest fleet: Cloud Run ADK + Gemini 3.5 + HN + public APIs + GCS snapshots.",
      "GET /api/trends stays the tape. Footprint POSTs /api/fleet.",
    ],
    permissions,
    permissionDiff,
    modelCard: {
      ...MODEL_CARD,
      minTransitions: HANDBOOK_FLOORS.minTransitions,
      minGoldTags: HANDBOOK_FLOORS.minGoldTags,
    },
    mermaid: { fleet: FLEET_GRAPH, ml: ML_GRAPH, lineage: LINEAGE_GRAPH },
    files: [
      "lib/histgb.ts",
      "lib/poi.ts",
      "lib/predict.ts",
      "lib/lineage.ts",
      "fleet/ingest_agent/agent.py",
      "fleet/permissions.json",
      "app/api/fleet/route.ts",
      "app/api/trends/route.ts",
    ],
  };
}

export function handbookMarkdown(payload: HandbookPayload): string {
  const tools = payload.permissions.tools ?? {};
  const rows = Object.entries(tools).map(
    ([name, cfg]) =>
      `| \`${name}\` | ${Boolean(cfg.enabled)} | ${cfg.channel ?? ""} | ${cfg.note ?? ""} |`,
  );
  return [
    "# HawkxAI handbook",
    "",
    `Generated ${payload.generatedAt}. Facts from repo files. Not an invented WHY.`,
    "",
    "## Product",
    ...payload.product.map((line) => `- ${line}`),
    "",
    "## Tool permissions",
    "",
    "| Tool | Enabled | Channel | Note |",
    "|---|---|---|---|",
    ...rows,
    "",
    "## Permission diff",
    "",
    payload.permissionDiff.summary,
    ...(payload.permissionDiff.changes.length
      ? payload.permissionDiff.changes.map((c) => `- \`${c.tool}\`: ${c.from} → ${c.to}`)
      : []),
    "",
    "## Model card",
    "",
    `- Next-window: ${payload.modelCard.nextWindow}`,
    `- Occupancy: ${payload.modelCard.occupancy}`,
    `- Lineage: ${payload.modelCard.lineage}`,
    `- Fit floors: ${payload.modelCard.minTransitions} transitions · ${payload.modelCard.minGoldTags} gold tags.`,
    "",
    "## Fleet",
    "",
    "```mermaid",
    payload.mermaid.fleet.trim(),
    "```",
    "",
    "## HistGB",
    "",
    "```mermaid",
    payload.mermaid.ml.trim(),
    "```",
    "",
    "## Lineage",
    "",
    "```mermaid",
    payload.mermaid.lineage.trim(),
    "```",
    "",
    "## Files",
    "",
    ...payload.files.map((f) => `- \`${f}\``),
    "",
  ].join("\n");
}
