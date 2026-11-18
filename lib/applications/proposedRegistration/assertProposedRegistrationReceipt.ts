import { isDeepStrictEqual } from "node:util";
import {
  proposedReceiptSchema,
  type ProposedCreateCall,
  type ProposedReadCall,
} from "./proposedRegistrationContract";
import { projectProposedRegistration } from "./projectProposedRegistration";
/** Validate without coercing bindings, IDs, dates, precision or disabled fields into success. */
export async function assertProposedRegistrationReceipt(
  raw: unknown,
  expected: ProposedCreateCall | ProposedReadCall,
) {
  const receipt = proposedReceiptSchema.parse(raw);
  const snapshot = receipt.snapshot;
  if (
    receipt.actor !== expected.actor ||
    receipt.workspace_id !== expected.workspace ||
    receipt.billing_owner_id !== expected.workspace ||
    receipt.environment !== expected.environment ||
    snapshot.workspace_id !== receipt.workspace_id ||
    snapshot.application_id !== receipt.application_id ||
    snapshot.environment !== receipt.environment
  )
    throw new Error("Receipt binding mismatch");
  const projected = await projectProposedRegistration(expected.actor, {
    name: snapshot.name,
    environment: snapshot.environment,
    allowed_origins: snapshot.allowed_origins,
    return_urls: snapshot.return_urls,
  });
  const origins = projected.registration.origins;
  const orderedReturns = origins
    .flatMap(o => o.return_urls)
    .sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  if (
    snapshot.name !== projected.registration.name ||
    !isDeepStrictEqual(
      snapshot.allowed_origins,
      origins.map(o => o.origin),
    ) ||
    !isDeepStrictEqual(snapshot.return_urls, orderedReturns) ||
    !isDeepStrictEqual(
      snapshot.origins.map(o => o.origin),
      origins.map(o => o.origin),
    )
  )
    throw new Error("Receipt canonical projection mismatch");
  if ("registration" in expected) {
    if (
      receipt.entitlement_revision !== expected.entitlementRevision ||
      !isDeepStrictEqual(projected.registration, expected.registration)
    )
      throw new Error("Receipt creation intent mismatch");
  } else if (
    receipt.application_id !== expected.application ||
    receipt.receipt_id !== expected.receipt
  ) {
    throw new Error("Receipt selection mismatch");
  }
  return receipt;
}
