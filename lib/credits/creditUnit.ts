/**
 * Credits in one US dollar.
 *
 * The single definition of what a credit is worth. Every conversion between
 * credits and dollars goes through `usdToCredits` or `creditsToUsd` below, so
 * changing the unit is changing this number and nothing else.
 *
 * Today a credit is a cent. chat#2000 proposes a micro-dollar (1_000_000),
 * which is fine enough to price-match providers on micropurchases: at fal's
 * $0.002 per second, one cent buys five seconds of audio and anything cheaper
 * cannot be charged without rounding to zero or up past cost.
 *
 * This must match `chat/lib/credits/creditUnit.ts` and the values stored in
 * `credits_usage.remaining_credits`. Changing it without the matching database
 * rescale misprices every charge by the ratio between the two.
 */
export const CREDITS_PER_USD = 100;

/**
 * Credits for a dollar amount.
 *
 * Always at least one credit, including for a zero cost. That is the existing
 * chat behaviour rather than a new rule: a request that reached a model is
 * chargeable even when the gateway reports no cost, and returning zero there
 * would make an unpriced model free. Callers that genuinely want zero for zero
 * — music, where a failed generation costs nothing — decide that themselves
 * before calling.
 *
 * @param usd - Cost in dollars.
 * @returns Whole credits, minimum 1.
 */
export function usdToCredits(usd: number): number {
  return Math.max(1, Math.round(usd * CREDITS_PER_USD));
}

/**
 * Dollar value of a credit amount.
 *
 * @param credits - Credit amount.
 * @returns Dollars, unformatted.
 */
export function creditsToUsd(credits: number): number {
  return credits / CREDITS_PER_USD;
}
