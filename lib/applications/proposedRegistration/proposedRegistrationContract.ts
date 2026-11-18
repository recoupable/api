import { z } from "zod";
import { applicationRegistrationSchema } from "../applicationRegistrationSchema";
export const proposedPolicySchema = z
  .object({
    status: z.literal("proposed_unadopted"),
    version: z.literal("proposed-personal-v1"),
    databaseHead: z.literal("f507a77696f20429f977df9885d6c8c11a5f304b"),
  })
  .strict();
const revision = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const environment = z.enum(["production", "development"]);
export const proposedCreateInputSchema = z
  .object({
    idempotency_key: z.string().min(1).max(128),
    expected_entitlement_revision: revision,
    registration: applicationRegistrationSchema.omit({ organization_id: true }).strict(),
  })
  .strict();
export const proposedReadInputSchema = z
  .object({
    application_id: z
      .string()
      .uuid()
      .transform(value => value.toLowerCase()),
    environment,
    receipt_id: z
      .string()
      .uuid()
      .transform(value => value.toLowerCase()),
  })
  .strict();
const timestamp = z.iso
  .datetime({ offset: true })
  .regex(/(?:Z|\+00:00)$/)
  .regex(/T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/);
const canonicalReceiptUuid = z
  .string()
  .uuid()
  .refine(value => value === value.toLowerCase());
export const proposedReceiptSchema = z
  .object({
    receipt_id: canonicalReceiptUuid,
    application_id: canonicalReceiptUuid,
    actor: canonicalReceiptUuid,
    workspace_id: canonicalReceiptUuid,
    billing_owner_id: canonicalReceiptUuid,
    environment,
    recorded_at: timestamp,
    entitlement_revision: revision,
    policy_version: z.literal("proposed-personal-v1"),
    snapshot: z
      .object({
        workspace_id: canonicalReceiptUuid,
        application_id: canonicalReceiptUuid,
        name: z.string().min(1).max(120),
        environment,
        allowed_origins: z.array(z.string()).min(1).max(32),
        return_urls: z.array(z.string()).min(1).max(32),
        origins: z
          .array(
            z
              .object({
                origin: z.string(),
                config_revision: z.literal(1),
                proof_revision: z.literal(1),
                cas_revision: z.literal(1),
                revoked: z.literal(false),
              })
              .strict(),
          )
          .min(1)
          .max(32),
      })
      .strict(),
    origins_verified: z.literal(false),
    bootstrap_enabled: z.literal(false),
    access_activated: z.literal(false),
    runtime_enabled: z.literal(false),
    production_persisted: z.literal(false),
    policy_status: z.literal("proposed_unadopted"),
    evidence_kind: z.literal("disposable_parent_assertion"),
  })
  .strict();
export type ProposedActor = { actor: string; workspace: string };
export type ProposedProjection = {
  environment: "production" | "development";
  registration: {
    name: string;
    origins: Array<{ origin: string; hostname: string; return_urls: string[] }>;
  };
};
export type ProposedCreateCall = ProposedActor &
  ProposedProjection & { key: string; entitlementRevision: number };
export type ProposedReadCall = ProposedActor & {
  application: string;
  environment: "production" | "development";
  receipt: string;
};
export interface ProposedStoragePort {
  create(input: ProposedCreateCall): Promise<unknown>;
  read(input: ProposedReadCall): Promise<unknown>;
}
export type ProposedDependencies = {
  policy: z.infer<typeof proposedPolicySchema>;
  storage: ProposedStoragePort;
};
/** Only an injected transaction adapter may report these definite outcomes; arbitrary thrown objects are unknown. */
export class ProposedStorageFailure extends Error {
  constructor(public readonly kind: "denied" | "conflict" | "outcome_unknown") {
    super(
      kind === "outcome_unknown"
        ? "Storage outcome unknown; retain original operation, key and input"
        : `Proposed storage ${kind}`,
    );
  }
}
