export const STRIPE_SUBSCRIPTION_PRICE_ID = "price_1RyDFD00JObOnOb53PcVOeBz";
export const STRIPE_SUBSCRIPTION_TRIAL_PERIOD_DAYS = 30;
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

// Stripe US-domestic card pricing. Used to gross-up credit top-up charges so
// the customer covers the processing fee.
export const STRIPE_CARD_FEE_PERCENTAGE = 0.029;
export const STRIPE_CARD_FEE_FIXED_CENTS = 30;

/**
 * Stripe Price id for the $19/mo Starter plan. Set in Vercel env, never in the
 * repo; empty means Starter is not for sale yet (checkout returns
 * `starter_unavailable`, plan resolution treats every paid price as pro).
 */
export const STRIPE_STARTER_PRICE_ID = process.env.STRIPE_STARTER_PRICE_ID ?? "";
