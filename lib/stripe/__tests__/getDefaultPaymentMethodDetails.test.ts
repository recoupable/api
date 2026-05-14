import { describe, it, expect, vi, beforeEach } from "vitest";

const { findDefaultPmMock, paymentMethodsRetrieveMock } = vi.hoisted(() => ({
  findDefaultPmMock: vi.fn(),
  paymentMethodsRetrieveMock: vi.fn(),
}));

vi.mock("@/lib/stripe/findDefaultPaymentMethodForCustomer", () => ({
  findDefaultPaymentMethodForCustomer: findDefaultPmMock,
}));

vi.mock("@/lib/stripe/client", () => ({
  default: { paymentMethods: { retrieve: paymentMethodsRetrieveMock } },
}));

const { getDefaultPaymentMethodDetails } = await import(
  "@/lib/stripe/getDefaultPaymentMethodDetails"
);

const CUSTOMER = "cus_test_abc";

beforeEach(() => vi.clearAllMocks());

describe("getDefaultPaymentMethodDetails", () => {
  it("returns null when the customer has no payment method on file", async () => {
    findDefaultPmMock.mockResolvedValue(null);

    const result = await getDefaultPaymentMethodDetails(CUSTOMER);

    expect(result).toBeNull();
    expect(paymentMethodsRetrieveMock).not.toHaveBeenCalled();
  });

  it("returns the card details when the default payment method is a card", async () => {
    findDefaultPmMock.mockResolvedValue("pm_card_visa");
    paymentMethodsRetrieveMock.mockResolvedValue({
      id: "pm_card_visa",
      type: "card",
      card: {
        brand: "visa",
        last4: "4242",
        exp_month: 12,
        exp_year: 2026,
        funding: "credit",
      },
    });

    const result = await getDefaultPaymentMethodDetails(CUSTOMER);

    expect(result).toEqual({
      brand: "visa",
      last4: "4242",
      exp_month: 12,
      exp_year: 2026,
      funding: "credit",
    });
    expect(paymentMethodsRetrieveMock).toHaveBeenCalledWith("pm_card_visa");
  });

  it("returns null when the default payment method is not a card type", async () => {
    findDefaultPmMock.mockResolvedValue("pm_bank_account");
    paymentMethodsRetrieveMock.mockResolvedValue({
      id: "pm_bank_account",
      type: "us_bank_account",
      us_bank_account: {
        last4: "6789",
        bank_name: "STRIPE TEST BANK",
      },
    });

    const result = await getDefaultPaymentMethodDetails(CUSTOMER);

    expect(result).toBeNull();
  });

  it("returns null when a card PaymentMethod is missing its card object", async () => {
    findDefaultPmMock.mockResolvedValue("pm_broken");
    paymentMethodsRetrieveMock.mockResolvedValue({
      id: "pm_broken",
      type: "card",
      card: null,
    });

    const result = await getDefaultPaymentMethodDetails(CUSTOMER);

    expect(result).toBeNull();
  });
});
