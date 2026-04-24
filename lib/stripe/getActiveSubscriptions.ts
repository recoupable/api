import Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";

/**
 * Fetch all active Stripe subscriptions via cursor pagination (Stripe's async
 * iterator). Filters on `current_period_end > now` to preserve the legacy
 * semantics (active includes in-grace-period). Returns [] on API error rather
 * than throwing — callers treat empty as "no subscribers" and degrade safely.
 */
export async function getActiveSubscriptions(): Promise<Stripe.Subscription[]> {
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    return await stripeClient()
      .subscriptions.list({ limit: 100, current_period_end: { gt: nowSec } })
      .autoPagingToArray({ limit: 10000 });
  } catch (error) {
    console.error("[ERROR] getActiveSubscriptions:", error);
    return [];
  }
}
