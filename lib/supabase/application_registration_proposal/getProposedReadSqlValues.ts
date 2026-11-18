import {
  ProposedStorageFailure,
  type ProposedReadCall,
} from "@/lib/applications/proposedRegistration/proposedRegistrationContract";
/** Bind a domain-owned selection; input-access failures are not SQL denials. */
export function getProposedReadSqlValues(call: ProposedReadCall): unknown[] {
  try {
    return [call.actor, call.workspace, call.application, call.environment, call.receipt];
  } catch {
    throw new ProposedStorageFailure("outcome_unknown");
  }
}
