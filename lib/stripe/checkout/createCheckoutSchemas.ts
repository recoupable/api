import { z } from "zod";

/** Body for `POST /api/subscriptions/checkout` (OpenAPI `CreateCheckoutRequest`). */
export const createCheckoutBodySchema = z
  .object({
    plan: z.enum(["starter", "pro"], { message: "plan must be starter or pro" }),
    successUrl: z.string().min(1, "successUrl is required").url("successUrl must be a valid URL"),
    cancelUrl: z.string().url("cancelUrl must be a valid URL").optional(),
  })
  .strict();

export type CreateCheckoutBody = z.infer<typeof createCheckoutBodySchema>;
