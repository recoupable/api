export const STRIPE_SUBSCRIPTION_PRICE_ID = "price_1RyDFD00JObOnOb53PcVOeBz";
export const STRIPE_SUBSCRIPTION_TRIAL_PERIOD_DAYS = 30;
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

// Stripe US-domestic card pricing. Used to gross-up credit top-up charges so
// the customer covers the processing fee.
export const STRIPE_CARD_FEE_PERCENTAGE = 0.029;
export const STRIPE_CARD_FEE_FIXED_CENTS = 30;
