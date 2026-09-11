import type Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";
import { listCustomerInvoicesBefore } from "@/lib/billing/listCustomerInvoicesBefore";

export interface ListAccountInvoicesParams {
  customerIds: string[];
  limit: number;
  startingAfter?: string;
}

export interface ListAccountInvoicesResult {
  invoices: Stripe.Invoice[];
  hasMore: boolean;
}

/**
 * One page of an account's invoices merged across every Stripe customer
 * tagged with it, newest first. `startingAfter` is the id of the last invoice
 * on the previous page; the next page holds invoices created before it, which
 * keeps one cursor valid across customers. `hasMore` is true when the merged
 * set was cut at `limit` or any customer reported a further page.
 */
export async function listAccountInvoices({
  customerIds,
  limit,
  startingAfter,
}: ListAccountInvoicesParams): Promise<ListAccountInvoicesResult> {
  if (customerIds.length === 0) return { invoices: [], hasMore: false };

  const createdBefore = startingAfter
    ? (await stripeClient.invoices.retrieve(startingAfter)).created
    : undefined;

  const pages = await Promise.all(
    customerIds.map(customerId => listCustomerInvoicesBefore({ customerId, limit, createdBefore })),
  );

  const merged = pages.flatMap(page => page.data).sort((a, b) => b.created - a.created);
  const invoices = merged.slice(0, limit);
  const hasMore = merged.length > limit || pages.some(page => page.has_more);
  return { invoices, hasMore };
}
