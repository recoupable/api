import Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";

const PAGE_LIMIT = 100;

/**
 * Lifetime value of a Stripe customer in cents: the sum of all succeeded
 * charges net of refunds. Charges cover both subscription payments and
 * credits top-ups in one number — invoices alone would miss top-ups.
 */
export const getCustomerLifetimeValue = async (customerId: string): Promise<number> => {
  let totalCents = 0;
  let startingAfter: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const listParams: Stripe.ChargeListParams = { customer: customerId, limit: PAGE_LIMIT };
    if (startingAfter) listParams.starting_after = startingAfter;

    const page = await stripeClient.charges.list(listParams);

    for (const charge of page.data) {
      if (charge.status !== "succeeded") continue;
      totalCents += charge.amount - charge.amount_refunded;
    }

    hasMore = page.has_more;
    const lastId = page.data.at(-1)?.id;
    if (!lastId) break;
    startingAfter = lastId;
  }

  return totalCents;
};
