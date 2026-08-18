/**
 * Monthly credit allotment for free-tier accounts.
 * Matches `chat/lib/consts.ts` so the chat sidebar and the public API agree.
 */
export const DEFAULT_CREDITS = 333;

/**
 * Monthly credit allotment for accounts on a pro plan (directly, via an
 * organization, or via an enterprise email domain). Effectively "don't think
 * about credits" for paying customers.
 */
export const PRO_CREDITS = 9999;

/**
 * Credits the Checkout Session offered on a 402 is sized for. Sized so one
 * purchase covers ~500 chat turns or 100 research calls.
 */
export const CREDIT_SHORTFALL_TOPUP_CREDITS = 500;

/**
 * Fallback `successUrl` baked into the Checkout Session offered on a 402.
 * Callers can plug their own URL when they have request context; the chat
 * stream and shared research helpers don't, so this is the sane default.
 */
export const CREDIT_SHORTFALL_SUCCESS_URL = "https://app.recoupable.dev";
