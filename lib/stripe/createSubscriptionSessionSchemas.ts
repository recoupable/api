import { z } from "zod";

const httpUrl = (label: string) =>
  z
    .string()
    .min(1, `${label} is required`)
    .url(`${label} must be a valid URL`)
    .refine(u => /^https?:\/\//i.test(u), `${label} must be an http or https URL`);

/** Body for `POST /api/subscriptions/sessions` (optional auth; plan defaults to pro). */
export const createSubscriptionSessionBodySchema = z
  .object({
    plan: z.enum(["starter", "pro"], { message: "plan must be starter or pro" }).default("pro"),
    successUrl: httpUrl("successUrl"),
    cancelUrl: httpUrl("cancelUrl").optional(),
  })
  .strict();

export type CreateSubscriptionSessionBody = z.infer<typeof createSubscriptionSessionBodySchema>;
