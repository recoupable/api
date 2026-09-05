import { describe, it, expect, vi, beforeEach } from "vitest";

const { retrieve, findDefaultPaymentMethodForCustomerMock } = vi.hoisted(() => ({
  retrieve: vi.fn(),
  findDefaultPaymentMethodForCustomerMock: vi.fn(),
}));
vi.mock("@/lib/stripe/client", () => ({ default: { paymentMethods: { retrieve } } }));
vi.mock("@/lib/stripe/findDefaultPaymentMethodForCustomer", () => ({
  findDefaultPaymentMethodForCustomer: findDefaultPaymentMethodForCustomerMock,
}));

const { findDefaultCardForCustomer } = await import("@/lib/stripe/findDefaultCardForCustomer");

describe("findDefaultCardForCustomer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the default payment method id when it is a card", async () => {
    findDefaultPaymentMethodForCustomerMock.mockResolvedValue("pm_card");
    retrieve.mockResolvedValue({ id: "pm_card", type: "card" });
    expect(await findDefaultCardForCustomer("cus_x")).toBe("pm_card");
    expect(retrieve).toHaveBeenCalledWith("pm_card");
  });

  it("returns null when the default is not a card", async () => {
    findDefaultPaymentMethodForCustomerMock.mockResolvedValue("pm_bank");
    retrieve.mockResolvedValue({ id: "pm_bank", type: "us_bank_account" });
    expect(await findDefaultCardForCustomer("cus_x")).toBeNull();
  });

  it("returns null when there is no default payment method", async () => {
    findDefaultPaymentMethodForCustomerMock.mockResolvedValue(null);
    expect(await findDefaultCardForCustomer("cus_x")).toBeNull();
    expect(retrieve).not.toHaveBeenCalled();
  });
});
