import Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";

/**
 * Fetch all active Stripe subscriptions via manual cursor pagination. Uses
 * Stripe's native `status: "active"` filter rather than a `current_period_end`
 * comparison (which is prone to clock-skew and timezone bugs). Loops until
 * `has_more` is false — no hard cap on the active subscription count. Returns
 * [] on API error so callers treat it as "no subscribers" and degrade safely.
 */
export async function getActiveSubscriptions(): Promise<Stripe.Subscription[]> {
  const results: Stripe.Subscription[] = [];
  let startingAfter: string | undefined;

  try {
    for (;;) {
      const page = await stripeClient().subscriptions.list({
        status: "active",
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      results.push(...page.data);
      if (!page.has_more || page.data.length === 0) break;
      startingAfter = page.data[page.data.length - 1].id;
    }
  } catch (error) {
    console.error("[ERROR] getActiveSubscriptions:", error);
  }

  return results;
}
