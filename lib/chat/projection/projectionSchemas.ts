import { z } from "zod";
const id = z.string().min(1).max(512);
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const metadata = z.record(z.string(), z.record(z.string(), z.json())).optional();
export const projectionOriginalSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("custom"),
      kind: z.string().regex(/^.+\..+$/),
      providerMetadata: metadata,
    })
    .strict(),
  z
    .object({
      type: z.literal("reasoning-file"),
      mediaType: z.string(),
      url: z.string(),
      providerMetadata: metadata,
    })
    .strict(),
]);
export const projectionObservationSchema = z
  .object({
    type: z.literal("data-recoup-sdk-observation"),
    id,
    data: z
      .object({
        version: z.literal(1),
        originRunId: id,
        originStepId: id,
        assistantMessageId: id,
        ordinal: integer,
        original: projectionOriginalSchema,
        fallback: z.object({ partIndex: integer.min(1), text: z.string() }).strict(),
      })
      .strict(),
  })
  .strict();
export const projectionProofSchema = z
  .object({
    contract: z.literal("recoup-sdk-projection/v1"),
    observations: z
      .array(
        z
          .object({
            observation: projectionObservationSchema,
            events: z.array(z.record(z.string(), z.json())).length(4),
            canonicalWrite: z.literal("requires-readback"),
          })
          .strict(),
      )
      .max(256),
  })
  .strict();
export type ProjectionObservation = z.infer<typeof projectionObservationSchema>;
export type ProjectionOriginal = z.infer<typeof projectionOriginalSchema>;
export type ProjectionProof = z.infer<typeof projectionProofSchema>;
export const projectionReceiptSchema = z
  .object({
    contract: z.literal("recoup-sdk-projection-proof/v1"),
    producerStepId: id,
    generatedProjectionObservations: projectionProofSchema,
  })
  .strict();
