import {
  ProposedStorageFailure,
  type ProposedCreateCall,
} from "@/lib/applications/proposedRegistration/proposedRegistrationContract";
import type { ProposedRegistrationSqlClient } from "./ProposedRegistrationSqlClient";

/** Unwired proposal-only single call. The domain owns authentication and receipt validation. */
export async function insertProposedApplicationRegistration(
  client: ProposedRegistrationSqlClient,
  call: ProposedCreateCall,
): Promise<unknown> {
  // Serialization/envelope failures are unknown, never SQL authorization outcomes.
  let values: unknown[];
  try {
    values = [
      call.actor,
      call.workspace,
      call.environment,
      call.key,
      call.entitlementRevision,
      JSON.stringify(call.registration),
    ];
  } catch {
    throw new ProposedStorageFailure("outcome_unknown");
  }
  let result;
  try {
    result = await client.query(
      "SELECT application_registration_execution_proposal.create_registration($1::uuid,$2::uuid,$3::text,$4::text,$5::bigint,$6::jsonb) AS receipt",
      values,
    );
  } catch (error) {
    let code: unknown;
    try {
      if (typeof error === "object" && error !== null && "code" in error) code = error.code;
    } catch {
      /* A malformed error is not a SQLSTATE. */
    }
    if (code === "42501") throw new ProposedStorageFailure("denied");
    if (code === "P2101") throw new ProposedStorageFailure("conflict");
    throw new ProposedStorageFailure("outcome_unknown");
  }
  try {
    if (!Array.isArray(result.rows) || result.rows.length !== 1 || result.rows[0]?.receipt == null)
      throw new Error();
    return result.rows[0].receipt;
  } catch {
    throw new ProposedStorageFailure("outcome_unknown");
  }
}
