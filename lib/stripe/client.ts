import Stripe from "stripe";

/**
 * Pinned Stripe API version. Matches the default version shipped with
 * `stripe@17.x` (the version used by `mono/chat`), so this service and
 * the chat app talk to the same Stripe schema.
 */
const STRIPE_API_VERSION = "2024-10-28.acacia" as const;

const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? process.env.STRIPE_SK;

// Fail-closed in production: a missing secret means every subscription
// lookup would silently 500 at first Stripe call. Outside production we
// let module-load succeed so tests and local builds don't break.
if (!stripeSecretKey && process.env.NODE_ENV === "production") {
  throw new Error(
    "Stripe secret key is not configured. Set STRIPE_SECRET_KEY (preferred) or STRIPE_SK.",
  );
}

const stripeClient = new Stripe(stripeSecretKey ?? "sk_test_unset", {
  apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
});

export default stripeClient;
