import { usdToCredits } from "@/lib/credits/usdToCredits";

/**
 * Monthly credit allotment for free-tier accounts, as dollars.
 * Matches `chat/lib/consts.ts` so the chat sidebar and the public API agree.
 */
export const DEFAULT_CREDITS_USD = 3.33;

/** Free-tier allotment in credits. Derived, so it survives a unit change. */
export const DEFAULT_CREDITS = usdToCredits(DEFAULT_CREDITS_USD);

/**
 * Monthly credit allotment for accounts on a pro plan (directly, via an
 * organization, or via an enterprise email domain). Effectively "don't think
 * about credits" for paying customers.
 */
export const PRO_CREDITS_USD = 99.99;

/** Pro allotment in credits. Derived, so it survives a unit change. */
export const PRO_CREDITS = usdToCredits(PRO_CREDITS_USD);

/**
 * Where a caller that ran out of credits is pointed. A constant, so a 402
 * creates nothing — scheduled tasks can hit the gate unattended without
 * writing to Stripe.
 *
 * Deliberately the app root and not a deep link: the account modal is where a
 * card is saved, and the app can move that without changing this contract.
 */
export const CREDIT_BILLING_URL = "https://app.recoupable.dev";
