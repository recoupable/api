import { z } from "zod";
import type { ProposedActor } from "./proposedRegistrationContract";
const credential = z.discriminatedUnion("mechanism", [
  z
    .object({
      mechanism: z.literal("recoup_api_key"),
      keyId: z.string().uuid(),
      actorAccountId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      mechanism: z.literal("privy"),
      appId: z.string().min(1),
      issuer: z.string().min(1),
      subject: z.string().min(1),
      actorAccountId: z.string().uuid(),
    })
    .strict(),
]);
const context = z
  .object({
    accountId: z.string().uuid(),
    orgId: z.null(),
    authToken: z.string().min(1),
    verificationEvidence: z
      .object({
        principal: credential,
        effectiveAccountId: z.string().uuid(),
        accountAccess: z.object({ basis: z.literal("self") }).strict(),
        organizationAccess: z.null(),
        executionResources: z
          .object({
            status: z.literal("unresolved"),
            reason: z.literal("resource_authorization_contract_missing"),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();
/** Validate identity observations; this is not an application entitlement or credential verifier. */
export function validateProposedRegistrationActor(value: unknown): ProposedActor {
  const auth = context.parse(value);
  const actor = auth.verificationEvidence.principal.actorAccountId;
  if (actor !== auth.accountId || actor !== auth.verificationEvidence.effectiveAccountId)
    throw new Error("Original actor binding unavailable");
  return { actor, workspace: actor };
}
