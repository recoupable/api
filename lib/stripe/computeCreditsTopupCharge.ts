import { STRIPE_CARD_FEE_FIXED_CENTS, STRIPE_CARD_FEE_PERCENTAGE } from "@/lib/stripe/config";

export interface CreditsTopupCharge {
  /** Processing fee in cents (Stripe US card pricing). */
  feeCents: number;
  /** Total amount charged to the customer in cents (credits + fee). */
  totalCents: number;
}

/**
 * Gross up a credits top-up so the customer covers the Stripe processing fee.
 *
 * Solves `charge - (charge * pct + fixed) = credits` for `charge`, ceil-rounded.
 * For 250 credits at 2.9% + 30¢: charge = ceil((250 + 30) / 0.971) = 289¢
 * → customer pays $2.89, Stripe takes ~38¢, business nets ≥ 250¢ (= $2.50).
 */
export function computeCreditsTopupCharge(credits: number): CreditsTopupCharge {
  if (!Number.isInteger(credits)) {
    throw new Error("credits must be an integer");
  }
  if (credits <= 0) {
    throw new Error("credits must be a positive integer");
  }

  const totalCents = Math.ceil(
    (credits + STRIPE_CARD_FEE_FIXED_CENTS) / (1 - STRIPE_CARD_FEE_PERCENTAGE),
  );
  return { feeCents: totalCents - credits, totalCents };
}
