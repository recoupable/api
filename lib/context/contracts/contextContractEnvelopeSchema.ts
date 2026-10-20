import { z } from "zod";
import { contextIngestSchema } from "../schema";
import { parseContextUrl } from "../parseContextUrl";
import { CONTEXT_CONTRACT_VERSION } from "./contextContractVersion";

export const contextContractScopeSchema = z.enum(["single_track", "single_video"]);

/**
 * Versioned, validated URL-only input envelope.
 *
 * Builds on `contextIngestSchema` without changing it: actor, owner and payer
 * still come from authentication, so caller-supplied identity is rejected by
 * the strict object. `scope` must agree with the URL kind. `assets` is a
 * reserved field: file, image and audio intake need separate storage and access
 * checks, so contract v1 accepts only an empty list and no asset bodies.
 */
export const contextContractEnvelopeSchema = contextIngestSchema
  .extend({
    contract_version: z.literal(CONTEXT_CONTRACT_VERSION),
    scope: contextContractScopeSchema,
    assets: z
      .array(z.unknown())
      .max(0, "Asset intake is not accepted in context-contract-v1; submit URL-only input")
      .optional(),
  })
  .superRefine((value, ctx) => {
    let kind: "track" | "video";
    try {
      kind = parseContextUrl(value.url).kind;
    } catch {
      return;
    }
    const expected = kind === "track" ? "single_track" : "single_video";
    if (value.scope !== expected)
      ctx.addIssue({
        code: "custom",
        path: ["scope"],
        message: `Scope must be ${expected} for this URL`,
      });
  });

export type ContextContractEnvelope = z.infer<typeof contextContractEnvelopeSchema>;
export type ContextContractScope = z.infer<typeof contextContractScopeSchema>;
