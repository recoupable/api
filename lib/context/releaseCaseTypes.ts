/** Database projections, deliberately separate from canonical identity and rights. */
export interface ReleaseCaseProjection {
  contract_version: "release-case-v1";
  operation: "release_metadata_reconciliation";
  request_id: string;
  subject_id: string;
  title: string | null;
  release_url: string | null;
  readiness: "partial" | "blocked";
  tracks: unknown[];
  track_page: Record<string, unknown>;
  identity_observations: Record<string, unknown>;
  evidence_manifest: Record<string, unknown>[];
  gaps: string[];
  reviewable: boolean;
  capabilities: Record<string, "unsupported">;
  cost: { provider_calls: 0; model_calls: 0; infrastructure_cost: "unmeasured" };
  fingerprint: string;
  latest_review: { id: string; decision: string; created_at: string; stale: boolean } | null;
}
export interface ReleaseCaseList {
  cases: { request_id: string; url: string; created_at: string; status: string }[];
  has_more: boolean;
  next_id: string | null;
}
export interface ReleaseCaseReview {
  id: string;
  created_at: string;
  actor_id: string;
  decision: "reviewed" | "needs_changes";
  policy_version: string;
  state: "saved" | "unavailable";
  stale: boolean | null;
  snapshot: Omit<ReleaseCaseProjection, "latest_review"> | null;
  note: string | null;
}
