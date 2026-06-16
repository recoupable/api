import { describe, it, expect, vi, beforeEach } from "vitest";
import { ensureSongstatsPaymentMethod } from "../ensureSongstatsPaymentMethod";
import { findStripeCustomerForAccount } from "@/lib/stripe/findStripeCustomerForAccount";
import { findDefaultPaymentMethodForCustomer } from "@/lib/stripe/findDefaultPaymentMethodForCustomer";
import { createCardOnFileSession } from "@/lib/stripe/createCardOnFileSession";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: vi.fn(() => ({})) }));
vi.mock("@/lib/stripe/findStripeCustomerForAccount", () => ({
  findStripeCustomerForAccount: vi.fn(),
}));
vi.mock("@/lib/stripe/findDefaultPaymentMethodForCustomer", () => ({
  findDefaultPaymentMethodForCustomer: vi.fn(),
}));
vi.mock("@/lib/stripe/createCardOnFileSession", () => ({ createCardOnFileSession: vi.fn() }));

describe("ensureSongstatsPaymentMethod", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null (proceed) when the account has a card on file", async () => {
    vi.mocked(findStripeCustomerForAccount).mockResolvedValue("cus_1");
    vi.mocked(findDefaultPaymentMethodForCustomer).mockResolvedValue("pm_1");

    const r = await ensureSongstatsPaymentMethod("acc_1");

    expect(r).toBeNull();
    expect(createCardOnFileSession).not.toHaveBeenCalled();
  });

  it("402s with a free-tier checkout link when there is no Stripe customer", async () => {
    vi.mocked(findStripeCustomerForAccount).mockResolvedValue(null);
    vi.mocked(createCardOnFileSession).mockResolvedValue({ url: "https://checkout/free" } as never);

    const r = await ensureSongstatsPaymentMethod("acc_1");

    expect(findDefaultPaymentMethodForCustomer).not.toHaveBeenCalled();
    expect(createCardOnFileSession).toHaveBeenCalledWith("acc_1", expect.any(String));
    expect((r as Response).status).toBe(402);
    expect(await (r as Response).json()).toMatchObject({
      status: "error",
      checkoutUrl: "https://checkout/free",
    });
  });

  it("402s with a checkout link when the customer exists but has no card", async () => {
    vi.mocked(findStripeCustomerForAccount).mockResolvedValue("cus_1");
    vi.mocked(findDefaultPaymentMethodForCustomer).mockResolvedValue(null);
    vi.mocked(createCardOnFileSession).mockResolvedValue({ url: "https://checkout/free" } as never);

    const r = await ensureSongstatsPaymentMethod("acc_1");

    expect((r as Response).status).toBe(402);
    expect(await (r as Response).json()).toMatchObject({ checkoutUrl: "https://checkout/free" });
  });
});
