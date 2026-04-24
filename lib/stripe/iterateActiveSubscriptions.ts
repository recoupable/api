import Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";

/**
 * Stream active Stripe subscriptions via cursor pagination. `status: "active"`
 * is Stripe's native filter — narrower and less error-prone than comparing
 * `current_period_end` to server clock (timezone / clock-skew hazards).
 *
 * Yielded as an async iterable so callers can fold results incrementally
 * (e.g. pluck `metadata.accountId` into a Set) instead of materializing the
 * whole list in memory. Errors are logged and end iteration — callers treat
 * a short iterator as "no subscribers" and degrade safely.
 */
export async function* iterateActiveSubscriptions(): AsyncGenerator<Stripe.Subscription> {
  try {
    for await (const sub of stripeClient().subscriptions.list({
      status: "active",
      limit: 100,
    })) {
      yield sub;
    }
  } catch (error) {
    console.error("[ERROR] iterateActiveSubscriptions:", error);
  }
}
