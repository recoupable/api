import Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";

/**
 * Fetch active Stripe subscriptions, optionally filtered by `metadata.accountId`.
 *
 * Subscriptions are tagged with `metadata.accountId` at checkout time in the
 * chat app; this helper is the read side of that contract. The query is
 * bounded at `limit: 100` — historically the active Stripe subscription set
 * has stayed below this cap, but if it grows past it the filter becomes
 * lossy. Flag the cap here rather than silently paginate.
 */
export async function getActiveSubscriptions(accountId?: string): Promise<Stripe.Subscription[]> {
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const subscriptions = await stripeClient().subscriptions.list({
      limit: 100,
      current_period_end: { gt: nowSec },
    });

    const data = subscriptions?.data ?? [];
    if (!accountId) return data;

    return data.filter(sub => sub.metadata?.accountId === accountId);
  } catch (error) {
    console.error("[ERROR] getActiveSubscriptions:", error);
    return [];
  }
}
