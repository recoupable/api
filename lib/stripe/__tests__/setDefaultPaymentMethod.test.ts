import { describe, it, expect, vi, beforeEach } from "vitest";

const { customersUpdate } = vi.hoisted(() => ({ customersUpdate: vi.fn() }));
vi.mock("@/lib/stripe/client", () => ({ default: { customers: { update: customersUpdate } } }));

const { setDefaultPaymentMethod } = await import("@/lib/stripe/setDefaultPaymentMethod");

describe("setDefaultPaymentMethod", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets invoice_settings.default_payment_method on the customer", async () => {
    customersUpdate.mockResolvedValue({ id: "cus_x" });
    await setDefaultPaymentMethod("cus_x", "pm_1");
    expect(customersUpdate).toHaveBeenCalledWith("cus_x", {
      invoice_settings: { default_payment_method: "pm_1" },
    });
  });
});
