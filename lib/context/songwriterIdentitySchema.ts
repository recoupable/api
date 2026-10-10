import { z } from "zod";
import { contextIngestSchema } from "./schema";

/** One saved songwriter-name request linked to one explicitly selected organization professional. */
export const songwriterIdentityOperationSchema = z.strictObject({
  action: z.literal("resolve_songwriter_identity"),
  organization_id: z.uuid().optional(),
  request_id: z.uuid(),
  professional_id: z.uuid(),
  // Names never select identity; the operator confirms the selected professional ID.
  confirmed: z.literal(true),
  idempotency_key: contextIngestSchema.shape.idempotency_key,
});
export const songwriterIdentityReceiptSchema = z.strictObject({
  resolution: z.strictObject({
    id: z.uuid(),
    request_id: z.uuid(),
    subject_id: z.uuid(),
    professional_id: z.uuid(),
    resolved_by: z.uuid(),
    resolution_basis: z.literal("operator_confirmed"),
    created_at: z.string().min(1),
  }),
  created: z.boolean(),
});
export type SongwriterIdentityOperation = z.infer<typeof songwriterIdentityOperationSchema>;
export type SongwriterIdentityReceipt = z.infer<typeof songwriterIdentityReceiptSchema>;
