import type { SavedCard } from "@/lib/stripe/getDefaultPaymentMethodDetails";

export interface AccountPaymentMethodResponse {
  account_id: string;
  card: SavedCard | null;
}

/**
 * Shapes the `{ account_id, card }` body documented at
 * `GET /api/accounts/{id}/payment-method`. `card` is the SavedCard returned
 * by `getDefaultPaymentMethodDetails`, or `null` when no usable card is on
 * file — callers branch on `null` to route to a checkout session instead of
 * a silent off-session charge.
 */
export function buildPaymentMethodResponse(args: {
  accountId: string;
  card: SavedCard | null;
}): AccountPaymentMethodResponse {
  return { account_id: args.accountId, card: args.card };
}
