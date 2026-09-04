import { z } from "zod";

/**
 * Body of `POST /api/accounts/{id}/payment-method`: only the redirect target.
 * Strict, so an `accountId` in the body 400s; the account comes from the path.
 */
export const paymentMethodSessionBodySchema = z
  .object({
    successUrl: z
      .string()
      .min(1, "successUrl is required")
      .url("successUrl must be a valid URL")
      .refine(u => /^https?:\/\//i.test(u), "successUrl must be an http or https URL"),
  })
  .strict();
