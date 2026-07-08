import { getCustomerEmail } from "@/lib/stripe/getCustomerEmail";
import { getCustomerLifetimeValue } from "@/lib/stripe/getCustomerLifetimeValue";
import { formatUsd } from "@/lib/stripe/formatUsd";

export interface CustomerSalesContext {
  email: string | null;
  customerLine: string;
  lifetimeLine: string;
  lifetimeCents: number;
}

/**
 * Resolves the customer identity and lifetime-value lines shared by every
 * sales notification. Pass `knownEmail` when the event payload already
 * carries the email (e.g. `invoice.customer_email`) to skip a lookup.
 */
export const buildCustomerSalesContext = async (
  customerId: string,
  knownEmail?: string | null,
): Promise<CustomerSalesContext> => {
  const [email, lifetimeCents] = await Promise.all([
    knownEmail ? Promise.resolve(knownEmail) : getCustomerEmail(customerId),
    getCustomerLifetimeValue(customerId),
  ]);

  return {
    email,
    customerLine: email ? `Customer: ${email} (${customerId})` : `Customer: ${customerId}`,
    lifetimeLine: `Lifetime value: ${formatUsd(lifetimeCents)}`,
    lifetimeCents,
  };
};
