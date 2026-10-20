import type {
  ReleaseTrackObservation,
  ReleaseTrackPage,
  ReleaseIdentityObservations,
  ReleaseCaseEvidence,
} from "./releaseCaseEvidenceTypes";
import type { ReleaseFormatObservation } from "./releaseFormatTypes";
/** Database projections, deliberately separate from canonical identity and rights. */
export interface ReleaseCaseProjection {
  contract_version: "release-case-v1";
  operation: "release_metadata_reconciliation";
  request_id: string;
  subject_id: string;
  title: string | null;
  release_url: string | null;
  release_format: ReleaseFormatObservation;
  readiness: "partial" | "blocked";
  tracks: ReleaseTrackObservation[];
  track_page: ReleaseTrackPage;
  identity_observations: ReleaseIdentityObservations;
  evidence_manifest: ReleaseCaseEvidence[];
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
  /** Immutable; reviews saved before `release_format` was projected do not contain it. */
  snapshot:
    | (Omit<ReleaseCaseProjection, "latest_review" | "release_format"> & {
        release_format?: ReleaseFormatObservation;
      })
    | null;
  note: string | null;
}
