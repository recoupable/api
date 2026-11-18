import {
  ProposedStorageFailure,
  type ProposedCreateCall,
} from "@/lib/applications/proposedRegistration/proposedRegistrationContract";
/** Serialize the canonical create call before entering SQL. */
export function getProposedCreateSqlValues(call: ProposedCreateCall): unknown[] {
  try {
    const registration = JSON.stringify(call.registration);
    if (typeof registration !== "string") throw new Error();
    return [
      call.actor,
      call.workspace,
      call.environment,
      call.key,
      call.entitlementRevision,
      registration,
    ];
  } catch {
    throw new ProposedStorageFailure("outcome_unknown");
  }
}
