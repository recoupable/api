import { z } from "zod";

export const createSubscriptionPortalBodySchema = z
  .object({
    returnUrl: z.string().min(1, "returnUrl is required").url("returnUrl must be a valid URL"),
    accountId: z.string().uuid("accountId must be a valid UUID").optional(),
  })
  .strict();
