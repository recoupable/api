import { ProposedStorageFailure } from "@/lib/applications/proposedRegistration/proposedRegistrationContract";
/** Unwrap one receipt unchanged; strict receipt validation belongs to the domain. */
export function getProposedSqlReceipt(result: unknown): unknown {
  try {
    if (typeof result !== "object" || result === null || !("rows" in result)) throw new Error();
    const rows = result.rows;
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error();
    const receipt = rows[0]?.receipt;
    if (receipt == null) throw new Error();
    return receipt;
  } catch {
    throw new ProposedStorageFailure("outcome_unknown");
  }
}
