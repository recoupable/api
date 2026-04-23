import Stripe from "stripe";

/**
 * Pinned Stripe API version. Matches the default version shipped with
 * `stripe@17.x` (the version used by `mono/chat`), so this service and
 * the chat app talk to the same Stripe schema.
 */
const STRIPE_API_VERSION = "2024-10-28.acacia" as const;

/**
 * Lazy Stripe client. Do not throw at module-load: Next.js evaluates this
 * module during `next build` (on Vercel, with `NODE_ENV=production`) while
 * collecting page data, and the preview env may not have the secret wired
 * up yet. Throwing here would fail the build before any request runs.
 *
 * Instead, defer the missing-secret check to the first call; the handler
 * catches and maps to a generic 500, which is the right shape for a
 * misconfigured environment.
 */
let cachedClient: Stripe | null = null;

function stripeClient(): Stripe {
  if (cachedClient) return cachedClient;

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? process.env.STRIPE_SK;

  if (!stripeSecretKey) {
    throw new Error(
      "Stripe secret key is not configured. Set STRIPE_SECRET_KEY (preferred) or STRIPE_SK.",
    );
  }

  cachedClient = new Stripe(stripeSecretKey, {
    apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
  });

  return cachedClient;
}

export default stripeClient;
