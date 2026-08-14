import type Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";

/**
 * Resolves a Stripe customer id to its email. Subscription webhook events
 * only carry the `cus_` id, so notification builders use this lookup.
 * Returns null (never throws) for deleted customers, missing emails, or
 * lookup failures — a notification must not fail the webhook for want of
 * an email.
 */
export const getCustomerEmail = async (customerId: string): Promise<string | null> => {
  try {
    const customer = (await stripeClient.customers.retrieve(customerId)) as
      | Stripe.Customer
      | Stripe.DeletedCustomer;
    if (customer.deleted) return null;
    return (customer as Stripe.Customer).email ?? null;
  } catch (error) {
    console.error("[getCustomerEmail]", { customerId, error });
    return null;
  }
};
