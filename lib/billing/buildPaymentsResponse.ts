import type Stripe from "stripe";
import { toAccountPayment, type AccountPayment } from "@/lib/billing/toAccountPayment";

export interface AccountPaymentsResponse {
  account_id: string;
  payments: AccountPayment[];
  hasMore: boolean;
}

/**
 * Wraps the documented `GET /api/accounts/{id}/payments` envelope around the
 * mapped rows (see toAccountPayment).
 */
export function buildPaymentsResponse(args: {
  accountId: string;
  invoices: Stripe.Invoice[];
  hasMore: boolean;
}): AccountPaymentsResponse {
  return {
    account_id: args.accountId,
    payments: args.invoices.map(toAccountPayment),
    hasMore: args.hasMore,
  };
}
