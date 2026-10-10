/** One immutable revision of a context document; the current pointer stays on the document. */
export interface ContextDocumentVersion {
  revision: number;
  result_id: string | null;
  change: "accepted" | "cleared";
  backfilled: boolean;
  recorded_at: string;
  result_status: string | null;
  evidence_kind: string | null;
  source_version_ids: string[];
  source_state: "live" | "withdrawn" | "removed" | null;
}
export interface ContextDocumentHistory {
  document: {
    id: string;
    subject_id: string;
    topic: string;
    current_revision: number;
    current_result_id: string | null;
    updated_at: string;
  };
  versions: ContextDocumentVersion[];
  has_more: boolean;
  next_before: number | null;
}
/** Another workspace's document reads as not found; existence is never confirmed. */
export type ContextDocumentHistoryResult =
  | ({ state: "found" } & ContextDocumentHistory)
  | { state: "not_found"; document: null; versions: []; has_more: false; next_before: null };
