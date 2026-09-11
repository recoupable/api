import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { pickPrimaryStripeCustomer } from "@/lib/stripe/pickPrimaryStripeCustomer";

const customer = (
  id: string,
  created: number,
  defaultPaymentMethod: string | null = null,
): Stripe.Customer =>
  ({
    id,
    created,
    invoice_settings: { default_payment_method: defaultPaymentMethod },
  }) as unknown as Stripe.Customer;

describe("pickPrimaryStripeCustomer", () => {
  it("returns null for no customers", () => {
    expect(pickPrimaryStripeCustomer([])).toBeNull();
  });

  it("returns the only customer even without a card", () => {
    expect(pickPrimaryStripeCustomer([customer("cus_only", 1)])?.id).toBe("cus_only");
  });

  it("prefers the customer holding a default payment method over an older or newer one without", () => {
    const picked = pickPrimaryStripeCustomer([
      customer("cus_invoices", 100),
      customer("cus_card", 50, "pm_1"),
      customer("cus_newest", 200),
    ]);
    expect(picked?.id).toBe("cus_card");
  });

  it("falls back to the newest customer when none holds a card", () => {
    const picked = pickPrimaryStripeCustomer([customer("cus_old", 100), customer("cus_new", 200)]);
    expect(picked?.id).toBe("cus_new");
  });

  it("breaks a tie between card holders by the newest", () => {
    const picked = pickPrimaryStripeCustomer([
      customer("cus_card_old", 100, "pm_1"),
      customer("cus_card_new", 200, "pm_2"),
    ]);
    expect(picked?.id).toBe("cus_card_new");
  });

  it("treats an expanded default_payment_method object as a card holder", () => {
    const expanded = {
      id: "cus_exp",
      created: 1,
      invoice_settings: { default_payment_method: { id: "pm_obj" } },
    } as unknown as Stripe.Customer;
    expect(pickPrimaryStripeCustomer([customer("cus_plain", 2), expanded])?.id).toBe("cus_exp");
  });
});
