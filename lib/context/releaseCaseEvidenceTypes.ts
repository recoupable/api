/** Nested keys preserve the existing Context release RPC contract. */
export interface ReleaseTrackObservation {
  slot_index: number;
  spotify_track_id: string;
  title: string | null;
  disc_number: number | null;
  track_number: number | null;
  credited_artists: { name: string | null; spotify_artist_id: string | null }[];
}
export interface ReleaseTrackPage {
  state: "ready" | "not_collected" | "needs_reconciliation";
  releaseId: string;
  sourceResultId?: string;
  coverage?: string | null;
  collectedSlots?: number;
  reportedTotal?: number | null;
  linkedSlots?: number;
  unavailableSlots?: number;
  slots: {
    slotIndex: number;
    spotifyTrackId: string;
    discNumber: number | null;
    trackNumber: number | null;
    sourceResultId: string;
  }[];
  nextCursor: number | null;
  hasMore: boolean;
}
export interface ReleaseIdentityObservations {
  state: "ready" | "not_collected" | "needs_reconciliation" | "unsupported";
  releaseSourceResultId?: string;
  resultId?: string;
  coverage?: string | null;
  candidates: {
    slotIndex: number;
    spotifyTrackId: string;
    observationState: "observed" | "missing_isrc" | "failed";
    isrc: string | null;
    mappingState: "conflict" | "existing_identifier_match" | "unmapped" | "unresolved";
  }[];
}
export interface ReleaseCaseEvidence {
  document_id: string;
  document_revision: number;
  result_id: string;
  source_version_id: string;
  source_url: string;
  retrieved_at: string;
}
