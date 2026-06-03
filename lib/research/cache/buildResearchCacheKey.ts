import { createHash } from "node:crypto";
import type { ResearchProvider } from "@/lib/research/providers/ResearchProvider";

export type ResearchCacheKeyInput = {
  provider: ResearchProvider;
  endpoint: string;
  entityType: string;
  entityId: string;
  source?: string | null;
  query?: Record<string, string>;
};

function stableObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableObject);
  if (typeof value !== "object" || value === null) return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, stableObject(child)]),
  );
}

export function buildResearchCacheKey(input: ResearchCacheKeyInput): string {
  const payload = JSON.stringify(stableObject(input));
  return createHash("sha256").update(payload).digest("hex");
}
