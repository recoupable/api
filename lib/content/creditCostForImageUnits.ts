import { usdToCredits } from "@/lib/credits/usdToCredits";

/**
 * fal's rate for the house still model, per generated image.
 *
 * Muse Image replaced Nano Banana 2 on 2026-09-01: $0.01 against NB2's $0.08,
 * and NB2 billed 2K output at 1.5x ($0.12), which is what our generators were
 * actually set to. A 12x difference on a line a single film pays 30-40 times.
 * Verified directly against fal's billing-events API, 2026-09-03: a real
 * 1-image request billed `cost_total: 0.01`.
 */
export const FAL_IMAGE_USD_PER_UNIT = 0.01;

/**
 * Credits to charge for a set of generated images.
 *
 * @param units - Billable units — one image is one unit.
 * @returns Whole credits; zero for a non-positive count.
 */
export function creditCostForImageUnits(units: number): number {
  if (units <= 0) return 0;
  return usdToCredits(units * FAL_IMAGE_USD_PER_UNIT);
}
