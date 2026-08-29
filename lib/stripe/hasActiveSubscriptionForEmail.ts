import stripeClient from "@/lib/stripe/client";

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

/**
 * Whether any Stripe customer with this email holds a live subscription.
 * Used to suppress lifecycle outreach to someone who already converted.
 * Returns false (never throws) on lookup failure, so a Stripe hiccup sends
 * at worst one extra email rather than failing the workflow.
 *
 * @param email - The email as Stripe recorded it on the customer.
 */
export async function hasActiveSubscriptionForEmail(email: string): Promise<boolean> {
  try {
    const customers = await stripeClient.customers.list({ email, limit: 10 });
    for (const customer of customers.data) {
      const subs = await stripeClient.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: 10,
      });
      if (subs.data.some(s => ACTIVE_STATUSES.has(s.status))) return true;
    }
    return false;
  } catch (error) {
    console.error("[hasActiveSubscriptionForEmail]", { email, error });
    return false;
  }
}
