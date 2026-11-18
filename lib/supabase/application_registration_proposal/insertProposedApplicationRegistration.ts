import type { ProposedCreateCall } from "@/lib/applications/proposedRegistration/proposedRegistrationContract";
import type { ProposedRegistrationSqlClient } from "./ProposedRegistrationSqlClient";
import { getProposedCreateSqlValues } from "./getProposedCreateSqlValues";
import { getProposedSqlFailure } from "./getProposedSqlFailure";
import { getProposedSqlReceipt } from "./getProposedSqlReceipt";

/** Unwired single call; the domain owns authentication and strict receipt validation. */
export async function insertProposedApplicationRegistration(
  client: ProposedRegistrationSqlClient,
  call: ProposedCreateCall,
): Promise<unknown> {
  const values = getProposedCreateSqlValues(call);
  let result;
  try {
    result = await client.query(
      "SELECT application_registration_execution_proposal.create_registration($1::uuid,$2::uuid,$3::text,$4::text,$5::bigint,$6::jsonb) AS receipt",
      values,
    );
  } catch (error) {
    throw getProposedSqlFailure(error, "create");
  }
  return getProposedSqlReceipt(result);
}
