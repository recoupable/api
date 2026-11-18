import { ProposedStorageFailure } from "@/lib/applications/proposedRegistration/proposedRegistrationContract";
/** Classify query failures only, without retaining raw errors or trusting their kind. */
export function getProposedSqlFailure(error: unknown, operation: "create" | "read") {
  let code: unknown;
  try {
    if (typeof error === "object" && error !== null && "code" in error) code = error.code;
  } catch {
    // A malformed error is not a SQLSTATE.
  }
  if (code === "42501") return new ProposedStorageFailure("denied");
  if (operation === "create" && code === "P2101") return new ProposedStorageFailure("conflict");
  return new ProposedStorageFailure("outcome_unknown");
}
