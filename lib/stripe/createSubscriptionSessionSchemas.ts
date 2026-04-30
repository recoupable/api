import { z } from "zod";

export const createSubscriptionSessionBodySchema = z
  .object({
    successUrl: z.string().min(1, "successUrl is required").url("successUrl must be a valid URL"),
  })
  .strict();
