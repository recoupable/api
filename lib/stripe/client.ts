import Stripe from "stripe";

/**
 * Lazily resolves a Stripe client.
 * This avoids import-time crashes during build when STRIPE_SK
 * is unavailable in the current environment.
 */
let cachedStripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (cachedStripeClient) {
    return cachedStripeClient;
  }

  const stripeSecretKey = process.env.STRIPE_SK;
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SK environment variable is required");
  }

  cachedStripeClient = new Stripe(stripeSecretKey);
  return cachedStripeClient;
}

const stripeClient = {
  get checkout() {
    return getStripeClient().checkout;
  },
} as Pick<Stripe, "checkout">;

export default stripeClient;
