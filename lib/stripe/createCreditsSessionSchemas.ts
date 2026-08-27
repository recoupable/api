import { CREDIT_DECIMALS } from "@/lib/credits/creditDecimals";
import { z } from "zod";

/** Stripe bills whole cents, so a top-up must be a whole number of them. */
const CREDITS_PER_CENT = 10 ** (CREDIT_DECIMALS - 2);

export const createCreditsSessionBodySchema = z
  .object({
    successUrl: z.string().min(1, "successUrl is required").url("successUrl must be a valid URL"),
    credits: z
      .number({ message: "credits is required" })
      .int("credits must be an integer")
      .min(1, "credits must be a positive integer")
      .multipleOf(
        CREDITS_PER_CENT,
        `credits must be a whole number of cents (a multiple of ${CREDITS_PER_CENT})`,
      ),
    accountId: z.string().uuid("accountId must be a valid UUID").optional(),
  })
  .strict();
