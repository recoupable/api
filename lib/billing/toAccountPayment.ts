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

const FALLBACK_DESCRIPTION = "Invoice";

/**
 * Maps one Stripe invoice to a documented `GET /api/accounts/{id}/payments`
 * row. Description is the first line item's text, else its price nickname,
 * else "Invoice"; `url` is the hosted invoice page or null.
 */
export function toAccountPayment(invoice: Stripe.Invoice): AccountPayment {
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
