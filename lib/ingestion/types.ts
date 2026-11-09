import type { z } from "zod";
import type { ingestionManifestSchema } from "./ingestionManifestSchema";
import type { ingestionContractSchema, ingestionFormatSchema } from "./schemas";

export type IngestionContract = z.infer<typeof ingestionContractSchema>;
export type IngestionFormat = z.infer<typeof ingestionFormatSchema>;
export type Values = Record<string, string | null>;
export interface SourceRow {
  source_row: number;
  source_sheet?: string;
  source_page?: number;
  values: Values;
}
export interface IngestionIssue {
  code: string;
  row?: number;
  field?: string;
}
export interface GoldArtifact {
  engine_version: string;
  contract_version: string;
  records: Values[];
  field_types: Record<string, IngestionContract["fields"][number]["type"]>;
}
export interface PipelineEvidence {
  rows_read: number;
  silver: { records: SourceRow[] };
  controls: { field: string; expected: string; actual: string; passed: boolean }[];
  issues: IngestionIssue[];
  issue_count: number;
}
export type PipelineResult = PipelineEvidence &
  ({ status: "ready"; gold: GoldArtifact } | { status: "held" | "rejected"; gold: null });
export interface ArtifactStore {
  read(key: string): Promise<Uint8Array | null>;
  /** Atomic create-if-absent. Never overwrites an existing object. */
  create(key: string, bytes: Uint8Array): Promise<boolean>;
}
export type IngestionManifest = z.infer<typeof ingestionManifestSchema>;
export interface IngestionDependencies {
  store: ArtifactStore;
  authorize(actor: string, organization?: string): Promise<string>;
  limit(
    actor: string,
    scope: string,
    action: "create" | "read" | "artifact" | "deliver",
  ): Promise<void>;
  dispatch(actor: string, organization: string | undefined, jobId: string): Promise<unknown>;
  acquire(
    scope: string,
    connectorId: string,
  ): Promise<{ bytes: Uint8Array; format: IngestionFormat; filename: string }>;
  deliver(
    scope: string,
    destinationId: string,
    deliveryId: string,
    gold: GoldArtifact,
    digest: string,
  ): Promise<{ committed: boolean; rows: number }>;
}

export interface IngestionSqlClient {
  query(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}
