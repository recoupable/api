import { usdToCredits } from "@/lib/credits/usdToCredits";

/**
 * Monthly credit allotment for free-tier accounts, as dollars.
 * Matches `chat/lib/consts.ts` so the chat sidebar and the public API agree.
 */
export const DEFAULT_CREDITS_USD = 3.33;

/** Free-tier allotment in credits. Derived, so it survives a unit change. */
export const DEFAULT_CREDITS = usdToCredits(DEFAULT_CREDITS_USD);

/**
 * Monthly credit allotment for the $19 Starter plan, as dollars: a little
 * more than the price, so the first paid rung feels like a gain.
 */
export const STARTER_CREDITS_USD = 20;

/** Starter allotment in credits. Derived, so it survives a unit change. */
export const STARTER_CREDITS = usdToCredits(STARTER_CREDITS_USD);

/**
 * Monthly credit allotment for accounts on a pro plan (directly, via an
 * organization, or via an enterprise email domain): three times the $99 price,
 * chosen against a p99 monthly spend of $71 (app#2044). Raise when a Pro
 * account approaches it.
 */
export const PRO_CREDITS_USD = 300;

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

/**
 * Where a caller that hit a plan task cap or cadence floor is pointed.
 * `/plan` is the page that upgrades Free → Starter / Pro.
 */
export const PLAN_BILLING_URL = "https://app.recoupable.dev/plan";
