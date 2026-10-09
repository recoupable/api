import { z } from "zod";

/** Registration is retained customer evidence, not an accepted analysis or rights decision. */
export const contextOriginalReceiptSchema = z
  .object({
    id: z.string().uuid(),
    owner_id: z.string().uuid(),
    source_id: z.string().uuid(),
    source_version_id: z.string().uuid(),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z
      .number()
      .int()
      .min(1)
      .max(50 * 1024 * 1024),
    media_type: z.enum(["application/pdf", "text/csv"]),
    status: z.literal("registered"),
    evidence_kind: z.literal("customer_assertion"),
    created_at: z.string().datetime({ offset: true }),
  })
  .strict();
