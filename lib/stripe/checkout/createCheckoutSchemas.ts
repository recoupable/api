import { z } from "zod";

const httpUrl = (label: string) =>
  z
    .string()
    .min(1, `${label} is required`)
    .url(`${label} must be a valid URL`)
    .refine(u => /^https?:\/\//i.test(u), `${label} must be an http or https URL`);

/** Body for `POST /api/subscriptions/checkout` (OpenAPI `CreateCheckoutRequest`). */
export const createCheckoutBodySchema = z
  .object({
    plan: z.enum(["starter", "pro"], { message: "plan must be starter or pro" }),
    successUrl: httpUrl("successUrl"),
    cancelUrl: httpUrl("cancelUrl").optional(),
  })
  .strict();

export type CreateCheckoutBody = z.infer<typeof createCheckoutBodySchema>;
