import type { NextRequest } from "next/server";
import { authenticateProposedRegistration } from "./authenticateProposedRegistration";
import { assertProposedRegistrationReceipt } from "./assertProposedRegistrationReceipt";
import {
  proposedReadInputSchema,
  proposedPolicySchema,
  ProposedStorageFailure,
  type ProposedDependencies,
} from "./proposedRegistrationContract";
/** Inactive historical read: selected identifiers never confer current management authority. */
export async function readProposedApplicationRegistration(
  request: NextRequest,
  input: unknown,
  dependencies: ProposedDependencies,
) {
  proposedPolicySchema.parse(dependencies?.policy);
  if (typeof dependencies.storage?.read !== "function")
    throw new Error("Proposed storage unavailable");
  const parsed = proposedReadInputSchema.parse(input);
  const actor = await authenticateProposedRegistration(request);
  const call = {
    ...actor,
    application: parsed.application_id,
    environment: parsed.environment,
    receipt: parsed.receipt_id,
  };
  let raw: unknown;
  try {
    raw = await dependencies.storage.read(structuredClone(call));
  } catch (error) {
    if (error instanceof ProposedStorageFailure && ["denied", "conflict"].includes(error.kind))
      throw error;
    throw new ProposedStorageFailure("outcome_unknown");
  }
  try {
    return await assertProposedRegistrationReceipt(raw, call);
  } catch {
    throw new ProposedStorageFailure("outcome_unknown");
  }
}
