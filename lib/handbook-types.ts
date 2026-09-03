import { MIN_HISTGB_SAMPLES, MIN_OCCUPANCY_LABELS, MODEL_CARD } from "./histgb";

export interface HandbookPermissions {
  tools: Record<string, { enabled?: boolean; channel?: string; note?: string }>;
}

export interface PermissionChange {
  tool: string;
  from: string;
  to: string;
}

export interface HandbookPayload {
  generatedAt: string;
  product: string[];
  permissions: HandbookPermissions;
  permissionDiff: { summary: string; changes: PermissionChange[] };
  modelCard: typeof MODEL_CARD & { minTransitions: number; minGoldTags: number };
  mermaid: { fleet: string; ml: string; lineage: string };
  files: string[];
}

export const HANDBOOK_FLOORS = {
  minTransitions: MIN_HISTGB_SAMPLES,
  minGoldTags: MIN_OCCUPANCY_LABELS,
} as const;
