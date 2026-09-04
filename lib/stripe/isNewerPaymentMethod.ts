import stripeClient from "@/lib/stripe/client";
import { findDefaultPaymentMethodForCustomer } from "@/lib/stripe/findDefaultPaymentMethodForCustomer";

/**
 * Whether `candidateId` should replace the customer's current default.
 * True when there is no default, when the candidate already is the default,
 * or when the candidate was created after the current default. Webhook
 * events for two setup sessions can arrive out of order; this keeps an
 * older card from overwriting a newer one.
 */
export async function isNewerPaymentMethod(
  customerId: string,
  candidateId: string,
): Promise<boolean> {
  const currentId = await findDefaultPaymentMethodForCustomer(customerId);
  if (!currentId || currentId === candidateId) return true;

  const [current, candidate] = await Promise.all([
    stripeClient.paymentMethods.retrieve(currentId),
    stripeClient.paymentMethods.retrieve(candidateId),
  ]);
  return candidate.created >= current.created;
}
