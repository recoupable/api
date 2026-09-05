import type Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";

export interface ListAccountInvoicesParams {
  customerId: string;
  limit: number;
  startingAfter?: string;
}

export interface ListAccountInvoicesResult {
  invoices: Stripe.Invoice[];
  hasMore: boolean;
}

/**
 * One page of a Stripe customer's invoices, newest first (Stripe's default
 * order). `startingAfter` is the id of the last invoice on the previous page.
 */
export async function listAccountInvoices({
  customerId,
  limit,
  startingAfter,
}: ListAccountInvoicesParams): Promise<ListAccountInvoicesResult> {
  const page = await stripeClient.invoices.list({
    customer: customerId,
    limit,
    ...(startingAfter ? { starting_after: startingAfter } : {}),
  });
  return { invoices: page.data, hasMore: page.has_more };
}
