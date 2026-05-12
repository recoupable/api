import type Stripe from "stripe";

export type StampDecision =
  | { action: "stamp"; reason: "missing" }
  | { action: "skip"; reason: "already-stamped" | "conflict" };

/**
 * Decide whether to stamp `metadata.accountId` on a Stripe Customer during
 * the one-time backfill of pre-existing subscriber Customers.
 */
export function shouldStampCustomerMetadata(
  customerMetadata: Stripe.Metadata | null | undefined,
  accountId: string,
): StampDecision {
  const existing = customerMetadata?.accountId;
  if (!existing) {
    return { action: "stamp", reason: "missing" };
  }
  if (existing === accountId) {
    return { action: "skip", reason: "already-stamped" };
  }
  return { action: "skip", reason: "conflict" };
}
