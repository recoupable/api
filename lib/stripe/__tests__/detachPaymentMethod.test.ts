import { describe, it, expect, vi, beforeEach } from "vitest";

const { paymentMethodsDetach } = vi.hoisted(() => ({ paymentMethodsDetach: vi.fn() }));
vi.mock("@/lib/stripe/client", () => ({
  default: { paymentMethods: { detach: paymentMethodsDetach } },
}));

const { detachPaymentMethod } = await import("@/lib/stripe/detachPaymentMethod");

describe("detachPaymentMethod", () => {
  beforeEach(() => vi.clearAllMocks());

  it("detaches the payment method by id", async () => {
    paymentMethodsDetach.mockResolvedValue({ id: "pm_1" });
    await detachPaymentMethod("pm_1");
    expect(paymentMethodsDetach).toHaveBeenCalledWith("pm_1");
  });
});
