/**
 * Stripe PaymentIntent metadata sentinel for an opt-in auto top-up charge.
 *
 * Distinct from `CREDIT_TOPUP_PURPOSE` on purpose: `processCreditsTopupPaymentIntent`
 * grants credits for `credits_topup` PaymentIntents on `payment_intent.succeeded`,
 * and an auto top-up grants its credits synchronously in `maybeAutoTopUp`. Sharing
 * the sentinel would grant twice.
 */
export const AUTO_TOPUP_PURPOSE = "credits_auto_topup";

/** Minimum gap between two auto top-up attempts on one account. */
export const AUTO_TOPUP_LEASE_MS = 10 * 60 * 1000;
