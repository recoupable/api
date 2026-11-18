import { z } from "zod";
export const packObservationPayloadSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("accepted"),
    request_id: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/),
  }),
  z.strictObject({
    kind: z.literal("completed"),
    request_id: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/),
    output_sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  }),
  z.strictObject({
    kind: z.literal("failed"),
    request_id: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/),
    reason_code: z.enum(["provider_failed", "response_invalid", "result_unavailable"]),
  }),
]);
