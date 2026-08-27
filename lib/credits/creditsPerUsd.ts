/**
 * Credits in one US dollar: the single definition of what a credit is worth.
 *
 * Every conversion between credits and dollars goes through `usdToCredits`
 * or `creditsToUsd`, so changing the unit is changing this number and nothing
 * else. Today a credit is a cent. recoupable/app#2000 moves it to a
 * micro-dollar (1_000_000), the same 6-decimal unit as USDC, so per-call
 * pricing can pass provider prices through exactly.
 *
 * Must match `chat/lib/credits/creditsPerUsd.ts` and the values stored in
 * `credits_usage.remaining_credits`; changing it without the matching database
 * rescale misprices every charge by the ratio between the two.
 */
export const CREDITS_PER_USD = 100;
