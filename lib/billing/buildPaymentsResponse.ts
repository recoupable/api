import type Stripe from "stripe";

export interface AccountPayment {
  id: string;
  createdAt: string;
  description: string;
  amountCents: number;
  currency: string;
  status: string;
  url: string | null;
}

export interface AccountPaymentsResponse {
  account_id: string;
  payments: AccountPayment[];
  hasMore: boolean;
}

const FALLBACK_DESCRIPTION = "Invoice";

/**
 * Maps Stripe invoices to the documented `GET /api/accounts/{id}/payments`
 * rows. Description is the first line item's text, else its price nickname,
 * else "Invoice"; `url` is the hosted invoice page or null.
 */
export function buildPaymentsResponse(args: {
  accountId: string;
  invoices: Stripe.Invoice[];
  hasMore: boolean;
}): AccountPaymentsResponse {
  return {
    account_id: args.accountId,
    payments: args.invoices.map(toPayment),
    hasMore: args.hasMore,
  };
}

function toPayment(invoice: Stripe.Invoice): AccountPayment {
  const line = invoice.lines?.data?.[0] as
    | { description?: string | null; price?: { nickname?: string | null } | null }
    | undefined;
  return {
    id: invoice.id,
    createdAt: new Date(invoice.created * 1000).toISOString(),
    description: line?.description || line?.price?.nickname || FALLBACK_DESCRIPTION,
    amountCents: invoice.amount_due,
    currency: invoice.currency,
    status: invoice.status ?? "draft",
    url: invoice.hosted_invoice_url ?? null,
  };
}
