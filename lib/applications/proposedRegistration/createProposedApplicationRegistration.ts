import type { NextRequest } from "next/server";
import { authenticateProposedRegistration } from "./authenticateProposedRegistration";
import { projectProposedRegistration } from "./projectProposedRegistration";
import { assertProposedRegistrationReceipt } from "./assertProposedRegistrationReceipt";
import {
  proposedCreateInputSchema,
  proposedPolicySchema,
  ProposedStorageFailure,
  type ProposedDependencies,
} from "./proposedRegistrationContract";
/** Inactive proposed create: one authenticated transaction invocation, no automatic retry or grant. */
export async function createProposedApplicationRegistration(
  request: NextRequest,
  input: unknown,
  dependencies: ProposedDependencies,
) {
  proposedPolicySchema.parse(dependencies?.policy);
  if (typeof dependencies.storage?.create !== "function")
    throw new Error("Proposed storage unavailable");
  const parsed = proposedCreateInputSchema.parse(input);
  const actor = await authenticateProposedRegistration(request);
  const projection = await projectProposedRegistration(actor.actor, parsed.registration);
  const call = {
    ...actor,
    ...projection,
    key: parsed.idempotency_key,
    entitlementRevision: parsed.expected_entitlement_revision,
  };
  let raw: unknown;
  try {
    raw = await dependencies.storage.create(structuredClone(call));
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
