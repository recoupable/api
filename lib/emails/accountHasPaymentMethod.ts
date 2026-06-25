import { findStripeCustomerForAccount } from "@/lib/stripe/findStripeCustomerForAccount";
import { findDefaultPaymentMethodForCustomer } from "@/lib/stripe/findDefaultPaymentMethodForCustomer";

/**
 * Read-only check for whether an account has a payment method (card) on file.
 *
 * Resolves the account's Stripe Customer without provisioning one
 * (`findStripeCustomerForAccount`), then checks for a default/attached card
 * (`findDefaultPaymentMethodForCustomer`). Returns false when no Customer
 * exists yet or the Customer has no card.
 *
 * @param accountId Must be a validated UUID (interpolated into a Stripe
 *   customer-search query downstream).
 */
export async function accountHasPaymentMethod(accountId: string): Promise<boolean> {
  const customerId = await findStripeCustomerForAccount(accountId);
  if (!customerId) return false;

  const paymentMethodId = await findDefaultPaymentMethodForCustomer(customerId);
  return paymentMethodId !== null;
}
