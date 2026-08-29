import stripeClient from "@/lib/stripe/client";

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);
const PAGE_LIMIT = 100;

/**
 * Whether any Stripe customer with this email holds a live subscription.
 * Used to suppress lifecycle outreach to someone who already converted.
 * Both lists are read at Stripe's maximum page size; an email with more
 * than 100 customers, or a customer with more than 100 subscriptions,
 * does not occur on this account base. Returns false (never throws) on
 * lookup failure, so a Stripe hiccup sends at worst one extra email
 * rather than failing the workflow.
 *
 * @param email - The email as Stripe recorded it on the customer.
 */
export async function hasActiveSubscriptionForEmail(email: string): Promise<boolean> {
  try {
    const customers = await stripeClient.customers.list({ email, limit: PAGE_LIMIT });
    for (const customer of customers.data) {
      const subs = await stripeClient.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: PAGE_LIMIT,
      });
      if (subs.data.some(s => ACTIVE_STATUSES.has(s.status))) return true;
    }
    return false;
  } catch (error) {
    console.error("[hasActiveSubscriptionForEmail] lookup failed", error);
    return false;
  }
}
