import Stripe from "stripe";

if (!process.env.STRIPE_SK) {
  throw new Error("STRIPE_SK environment variable is required");
}

const stripeClient = new Stripe(process.env.STRIPE_SK);

export default stripeClient;
