import type { ContextEnrichmentModule } from "./runContextEnrichment";

export interface PlanNode {
  key: string;
  dependsOn: string[];
  /** Receipts identify saved evidence; load its authorized content here when needed. */
  prepare: (receipts: Record<string, unknown>) => Promise<ContextEnrichmentModule>;
}
export interface Outcome {
  key: string;
  status: "saved" | "reused" | "failed" | "blocked";
  startedAt?: string;
  elapsedMs?: number;
  receipt?: unknown;
  blockedBy?: string[];
  failureStage?: "authorize" | "prepare" | "execute_or_persist";
}
