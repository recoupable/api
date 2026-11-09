import type { z } from "zod";
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
export interface PipelineResult {
  status: "ready" | "held" | "rejected";
  silver: { records: SourceRow[] };
  gold: GoldArtifact | null;
  controls: { field: string; expected: string; actual: string; passed: boolean }[];
  issues: IngestionIssue[];
  issue_count: number;
}
export interface ArtifactStore {
  read(key: string): Promise<Uint8Array | null>;
  /** Atomic create-if-absent. Never overwrites an existing object. */
  create(key: string, bytes: Uint8Array): Promise<boolean>;
}
export interface IngestionManifest {
  job_id: string;
  input_sha256: string;
  engine_version: string;
  scope: string;
  format: IngestionFormat;
  filename: string;
  bronze_key: string;
  bronze_sha256: string;
  source: { kind: "inline" | "connector"; connector_id?: string };
  contract: IngestionContract;
  created_at: string;
}
export interface IngestionDependencies {
  store: ArtifactStore;
  authorize(actor: string, organization?: string): Promise<string>;
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
