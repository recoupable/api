import { creditsToUsd } from "@/lib/credits/creditsToUsd";

/**
 * Whole Stripe cents for a credit amount.
 *
 * Stripe bills in cents whatever the ledger unit is. Top-up requests are
 * validated to whole cents (`credits` a multiple of 10^(CREDIT_DECIMALS - 2)),
 * so this is exact; the rounding only guards floating point.
 *
 * @param credits - Credits, whole ledger units.
 * @returns Cents, integer.
 */
export function creditsToStripeCents(credits: number): number {
  return Math.round(creditsToUsd(credits) * 100);
}
