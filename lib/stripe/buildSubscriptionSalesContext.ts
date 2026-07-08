import type Stripe from "stripe";
import { getCustomerEmail } from "@/lib/stripe/getCustomerEmail";
import { getCustomerLifetimeValue } from "@/lib/stripe/getCustomerLifetimeValue";
import { formatUsd } from "@/lib/stripe/formatUsd";

export interface SubscriptionSalesContext {
  email: string | null;
  customerLine: string;
  planLine: string;
  lifetimeLine: string;
}

/**
 * Resolves the shared message lines every subscription sales notification
 * carries: who the customer is, what plan the subscription is on, and the
 * customer's lifetime value.
 */
export const buildSubscriptionSalesContext = async (
  subscription: Stripe.Subscription,
): Promise<SubscriptionSalesContext> => {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const [email, lifetimeCents] = await Promise.all([
    getCustomerEmail(customerId),
    getCustomerLifetimeValue(customerId),
  ]);

  const price = subscription.items?.data?.[0]?.price;
  const planLine =
    price?.unit_amount != null && price.recurring?.interval
      ? `Plan: ${formatUsd(price.unit_amount)}/${price.recurring.interval}`
      : "Plan: unknown";

  return {
    email,
    customerLine: email ? `Customer: ${email} (${customerId})` : `Customer: ${customerId}`,
    planLine,
    lifetimeLine: `Lifetime value: ${formatUsd(lifetimeCents)}`,
  };
};
