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
 * Where a caller that ran out of credits is pointed. A constant, so a 402
 * creates nothing — scheduled tasks can hit the gate unattended without
 * writing to Stripe.
 *
 * Deliberately the app root and not a deep link: the account modal is where a
 * card is saved, and the app can move that without changing this contract.
 */
export const CREDIT_BILLING_URL = "https://app.recoupable.dev";
