import Stripe from "stripe";

/**
 * Singleton Stripe client.
 * Reads STRIPE_SK from the environment at import time.
 */
const stripeClient = new Stripe(process.env.STRIPE_SK as string);

export default stripeClient;
