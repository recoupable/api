import stripeClient from "@/lib/stripe/client";
import Stripe from "stripe";

const PAGE_LIMIT = 100;

/**
 * Lists active subscriptions whose `metadata.accountId` matches.
 * Stops after the first page that yields a match (callers only need one).
 * Paginates until Stripe reports no more pages (no fixed page cap — avoids missing matches deep in the list).
 */
export const getActiveSubscriptions = async (accountId: string) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const activeSubscriptions: Stripe.Subscription[] = [];
    let startingAfter: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const listParams: Stripe.SubscriptionListParams = {
        limit: PAGE_LIMIT,
        current_period_end: { gt: now },
      };
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
      if (startingAfter !== undefined && lastId === startingAfter) break;
      startingAfter = lastId;
    }

    return activeSubscriptions;
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return [];
  }
};
