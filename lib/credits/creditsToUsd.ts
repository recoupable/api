import { CREDITS_PER_USD } from "@/lib/credits/creditsPerUsd";

/**
 * Dollar value of a credit amount.
 *
 * @param credits - Credit amount.
 * @returns Dollars, unformatted.
 */
export function creditsToUsd(credits: number): number {
  return credits / CREDITS_PER_USD;
}
