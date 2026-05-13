import { z } from "zod";

export const createCreditsSessionBodySchema = z
  .object({
    successUrl: z.string().min(1, "successUrl is required").url("successUrl must be a valid URL"),
    credits: z
      .number({ message: "credits is required" })
      .int("credits must be an integer")
      .min(1, "credits must be a positive integer"),
    accountId: z.string().uuid("accountId must be a valid UUID").optional(),
  })
  .strict();
