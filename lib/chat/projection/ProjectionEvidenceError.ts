export type ProjectionEvidenceCode =
  | "invalid_observation"
  | "span_mismatch"
  | "authority_mismatch"
  | "producer_mismatch"
  | "proof_missing"
  | "proof_pending"
  | "canonical_mismatch"
  | "evidence_missing"
  | "evidence_expired"
  | "evidence_unavailable"
  | "key_unavailable"
  | "decryption_failed"
  | "evidence_timeout"
  | "invalid_evidence"
  | "evidence_limit"
  | "cancelled";
/** Sanitized failures must never disclose run inputs, provider metadata or credentials. */
export class ProjectionEvidenceError extends Error {
  constructor(readonly code: ProjectionEvidenceCode) {
    super("Projection history evidence unavailable");
    this.name = "ProjectionEvidenceError";
  }
}
