import { z } from "zod";

export const createSubscriptionSessionBodySchema = z
  .object({
    successUrl: z.string().min(1, "successUrl is required").url("successUrl must be a valid URL"),
    plan: z
      .enum(["starter", "pro"])
      .default("pro")
      .describe(
        "Which plan to check out. Pro starts a 30-day trial; Starter is charged at checkout.",
      ),
  })
  .strict();
