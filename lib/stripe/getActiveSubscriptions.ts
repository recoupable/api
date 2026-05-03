import stripeClient from "@/lib/stripe/client";
import Stripe from "stripe";

const PAGE_LIMIT = 100;

/** Caps sequential `subscriptions.list` calls to avoid runaway latency on large Stripe accounts. */
export const MAX_SUBSCRIPTION_LIST_PAGES = 50;

/**
 * Lists active subscriptions whose `metadata.accountId` matches.
 * Stops after the first page that yields a match (callers only need one).
 * When `stripeCustomerId` is set, scopes the Stripe list to that customer.
 */
export const getActiveSubscriptions = async (accountId: string, stripeCustomerId?: string) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const activeSubscriptions: Stripe.Subscription[] = [];
    let startingAfter: string | undefined;
    let hasMore = true;
    let pageIndex = 0;

    while (hasMore && pageIndex < MAX_SUBSCRIPTION_LIST_PAGES) {
      pageIndex += 1;
      const listParams: Stripe.SubscriptionListParams = {
        limit: PAGE_LIMIT,
        current_period_end: { gt: now },
      };
      if (stripeCustomerId) {
        listParams.customer = stripeCustomerId;
      }
      if (startingAfter) {
        listParams.starting_after = startingAfter;
      }

      const page = await stripeClient.subscriptions.list(listParams);

      activeSubscriptions.push(
        ...page.data.filter((s: Stripe.Subscription) => s.metadata?.accountId === accountId),
      );

      if (activeSubscriptions.length > 0) {
        break;
      }

      hasMore = page.has_more;
      const lastId = page.data.at(-1)?.id;
      if (!lastId) break;
      startingAfter = lastId;
    }

    return activeSubscriptions;
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return [];
  }
};
