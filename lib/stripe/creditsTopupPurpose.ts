/**
 * Stripe Checkout Session metadata sentinel that identifies a credits top-up.
 *
 * Set by `createCreditsStripeSession` on outbound sessions and checked by
 * `processCreditsTopupSession` on inbound `checkout.session.completed`
 * webhooks — the two must stay in sync or webhook events will silently skip.
 */
export const CREDIT_TOPUP_PURPOSE = "credits_topup";
