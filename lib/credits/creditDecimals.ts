/**
 * Decimal places in a credit: the single definition of what a credit is worth.
 *
 * Six, the same unit as USDC: 1,000,000 credits = $1.00, so a credit is a
 * micro-dollar and provider prices pass through exactly. Every conversion
 * between credits and dollars goes through `usdToCredits` or `creditsToUsd`,
 * which are viem's `parseUnits` / `formatUnits` at this precision.
 *
 * Must match `chat/lib/credits/creditDecimals.ts` and the values stored in
 * `credits_usage.remaining_credits`; the database rescale
 * (recoupable/app#2000, database#62) and the deploy of this constant have to
 * land in the same window or every charge is off by the ratio between them.
 */
export const CREDIT_DECIMALS = 6;
