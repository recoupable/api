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
 * Credits added per automatic top-up when a request would push an account below
 * the cost of that request. Sized so a single charge covers ~500 chat turns or
 * 100 research calls; revisit if latency-per-recharge becomes a UX issue.
 */
export const CREDIT_AUTO_RECHARGE_CREDITS = 500;

/**
 * PaymentIntent metadata.purpose stamped on auto-recharge charges. The webhook
 * handler short-circuits when this is the purpose because the request thread
 * already incremented `remaining_credits` after the charge resolved.
 * (`processCreditsTopupPaymentIntent` only acts on `purpose === "credits_topup"`
 * so anything else passes through untouched.)
 */
export const CREDIT_AUTO_RECHARGE_PURPOSE = "credits_auto_recharge";

/**
 * Fallback `successUrl` baked into the Checkout Session that's offered when an
 * auto-recharge can't proceed (no card / decline). Callers can plug their own
 * URL when they have request context; the chat stream and shared research
 * helpers don't, so this is the sane default.
 */
export const CREDIT_AUTO_RECHARGE_FALLBACK_SUCCESS_URL =
  "https://sandbox.recoupable.com/settings/profile";
