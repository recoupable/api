import { encodeStrictJson } from "@/lib/chat/fence/encodeStrictJson";
import { ProjectionEvidenceError } from "./ProjectionEvidenceError";
export function encodeProjectionEvidence(value: unknown, maxBytes = 1_048_576) {
  try {
    return encodeStrictJson(value, { omitUndefinedObjectProperties: true, maxBytes });
  } catch (error) {
    throw new ProjectionEvidenceError(
      error instanceof Error && error.message === "JSON exceeds byte budget"
        ? "evidence_limit"
        : "invalid_evidence",
    );
  }
}
