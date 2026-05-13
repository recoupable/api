import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

const { customersRetrieve, paymentMethodsList } = vi.hoisted(() => ({
  customersRetrieve: vi.fn(),
  paymentMethodsList: vi.fn(),
}));

vi.mock("@/lib/stripe/client", () => ({
  default: {
    customers: { retrieve: customersRetrieve },
    paymentMethods: { list: paymentMethodsList },
  },
}));

const { findDefaultPaymentMethodForCustomer } = await import(
  "@/lib/stripe/findDefaultPaymentMethodForCustomer"
);

const customer = (overrides: Partial<Stripe.Customer> = {}): Stripe.Customer =>
  ({
    id: "cus_x",
    deleted: false,
    invoice_settings: { default_payment_method: null },
    ...overrides,
  }) as unknown as Stripe.Customer;

const listResult = (data: Array<{ id: string }>): Stripe.ApiList<Stripe.PaymentMethod> =>
  ({
    object: "list",
    data: data as unknown as Stripe.PaymentMethod[],
    has_more: false,
    url: "/v1/payment_methods",
  }) as unknown as Stripe.ApiList<Stripe.PaymentMethod>;

describe("findDefaultPaymentMethodForCustomer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the customer's invoice_settings.default_payment_method when set", async () => {
    customersRetrieve.mockResolvedValue(
      customer({
        invoice_settings: {
          default_payment_method: "pm_default",
        } as Stripe.Customer["invoice_settings"],
      }),
    );

    expect(await findDefaultPaymentMethodForCustomer("cus_x")).toBe("pm_default");
    expect(paymentMethodsList).not.toHaveBeenCalled();
  });

  it("falls back to the first attached card when no default is set", async () => {
    customersRetrieve.mockResolvedValue(customer());
    paymentMethodsList.mockResolvedValue(listResult([{ id: "pm_first" }, { id: "pm_second" }]));

    expect(await findDefaultPaymentMethodForCustomer("cus_x")).toBe("pm_first");
    expect(paymentMethodsList).toHaveBeenCalledWith({
      customer: "cus_x",
      type: "card",
      limit: 1,
    });
  });

  it("returns null when no default and no attached cards", async () => {
    customersRetrieve.mockResolvedValue(customer());
    paymentMethodsList.mockResolvedValue(listResult([]));

    expect(await findDefaultPaymentMethodForCustomer("cus_x")).toBeNull();
  });

  it("returns null when the Customer was deleted", async () => {
    customersRetrieve.mockResolvedValue({
      id: "cus_x",
      deleted: true,
    } as unknown as Stripe.Customer);

    expect(await findDefaultPaymentMethodForCustomer("cus_x")).toBeNull();
    expect(paymentMethodsList).not.toHaveBeenCalled();
  });
});
