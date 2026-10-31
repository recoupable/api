import type { ReleasePackBrief, ReleasePackDeliverables } from "./releasePackSchema";
import type { buildReleasePackQuote, PackAssetKind } from "./buildReleasePackQuote";
export type PackQuote = ReturnType<typeof buildReleasePackQuote> & {
  id: string;
  revision: number;
  expires_at: string;
  retry_asset_id?: string;
  sources?: import("./importPackSources").PackSources;
};
export type PackFile = { storage_key: string; content_type: string; bytes: number; url?: string };
export type PackAsset = {
  id: string;
  job_id: string;
  kind: PackAssetKind;
  ordinal: number;
  status: "pending" | "running" | "completed" | "failed" | "uncertain";
  attempt: number;
  credits: number;
  maximum_usd: number;
  provider_state: Record<string, unknown>;
  files: PackFile[];
  caption: string | null;
  qa: { [key: string]: unknown; passed: boolean } | null;
  error: string | null;
};
export type PackJob = {
  [key: string]: unknown;
  id: string;
  owner_id: string;
  created_by: string;
  revision: number;
  status: string;
  brief: ReleasePackBrief;
  deliverables: ReleasePackDeliverables;
  quote: PackQuote | null;
  held_credits: number;
  consumed_credits: number;
  workflow_run_id: string | null;
  error: string | null;
};
export type PackSnapshot = {
  job: PackJob;
  assets: PackAsset[];
  dispatch?: boolean;
  claimed?: boolean;
  asset?: PackAsset;
};
export type PackActor = { accountId: string; organizationId?: string };
