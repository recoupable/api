import stripeClient from "@/lib/stripe/client";

/**
 * Return the account_ids stamped on active Stripe subscriptions. Paginates
 * via `starting_after` until `has_more` is false, so there's no hard cap on
 * the active subscription count. `status: "active"` is Stripe's native
 * filter — avoids the clock-skew hazard of comparing `current_period_end`
 * against server time. Returns [] on API error so callers degrade safely.
 */
export async function getActiveSubscriptionAccountIds(): Promise<string[]> {
  const accountIds: string[] = [];
  let startingAfter: string | undefined;

  try {
    for (;;) {
      const page = await stripeClient().subscriptions.list({
        status: "active",
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      for (const sub of page.data) {
        const id = sub.metadata?.accountId;
        if (id) accountIds.push(id);
      }
      if (!page.has_more || page.data.length === 0) break;
      startingAfter = page.data[page.data.length - 1].id;
    }
  } catch (error) {
    console.error("[ERROR] getActiveSubscriptionAccountIds:", error);
  }

  return accountIds;
}
