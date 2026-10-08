import { z } from "zod";
import { contextIngestSchema } from "./schema";

export const releaseCaseOperationSchemas = [
  z.strictObject({
    action: z.literal("list_release_cases"),
    organization_id: z.uuid().optional(),
    after_id: z.uuid().optional(),
  }),
  z.strictObject({
    action: z.literal("read_release_case"),
    organization_id: z.uuid().optional(),
    request_id: z.uuid(),
  }),
  z.strictObject({
    action: z.literal("read_release_case_review"),
    organization_id: z.uuid().optional(),
    review_id: z.uuid(),
  }),
  z.strictObject({
    action: z.literal("review_release_case"),
    organization_id: z.uuid().optional(),
    request_id: z.uuid(),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    decision: z.enum(["reviewed", "needs_changes"]),
    note: z.string().trim().max(2000).default(""),
    idempotency_key: contextIngestSchema.shape.idempotency_key,
  }),
] as const;
export type ReleaseCaseOperation = z.infer<(typeof releaseCaseOperationSchemas)[number]>;
