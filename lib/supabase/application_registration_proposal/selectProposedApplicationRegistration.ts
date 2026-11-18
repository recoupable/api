import type { ProposedReadCall } from "@/lib/applications/proposedRegistration/proposedRegistrationContract";
import type { ProposedRegistrationSqlClient } from "./ProposedRegistrationSqlClient";
import { getProposedReadSqlValues } from "./getProposedReadSqlValues";
import { getProposedSqlFailure } from "./getProposedSqlFailure";
import { getProposedSqlReceipt } from "./getProposedSqlReceipt";

/** Unwired single call; the domain owns authentication and strict receipt validation. */
export async function selectProposedApplicationRegistration(
  client: ProposedRegistrationSqlClient,
  call: ProposedReadCall,
): Promise<unknown> {
  const values = getProposedReadSqlValues(call);
  let result;
  try {
    result = await client.query(
      "SELECT application_registration_execution_proposal.read_registration($1::uuid,$2::uuid,$3::uuid,$4::text,$5::uuid) AS receipt",
      values,
    );
  } catch (error) {
    throw getProposedSqlFailure(error, "read");
  }
  return getProposedSqlReceipt(result);
}
