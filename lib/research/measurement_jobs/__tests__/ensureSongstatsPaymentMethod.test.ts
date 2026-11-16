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

  it("returns an entitlement failure without creating checkout when there is no customer", async () => {
    vi.mocked(findStripeCustomerForAccount).mockResolvedValue(null);
    vi.mocked(createCardOnFileSession).mockResolvedValue({ url: "https://checkout/free" } as never);

    const r = await ensureSongstatsPaymentMethod("acc_1");

    expect(findDefaultPaymentMethodForCustomer).not.toHaveBeenCalled();
    expect(createCardOnFileSession).not.toHaveBeenCalled();
    expect((r as Response).status).toBe(402);
    expect(await (r as Response).json()).toMatchObject({
      status: "error",
      error: "payment_method_required",
      message: "This research feature is unavailable with the account's current entitlements.",
    });
  });

  it("returns no checkout or upgrade link when an existing customer has no card", async () => {
    vi.mocked(findStripeCustomerForAccount).mockResolvedValue("cus_1");
    vi.mocked(findDefaultPaymentMethodForCustomer).mockResolvedValue(null);
    vi.mocked(createCardOnFileSession).mockResolvedValue({ url: "https://checkout/free" } as never);

    const r = await ensureSongstatsPaymentMethod("acc_1");

    expect((r as Response).status).toBe(402);
    const body = await (r as Response).json();
    expect(body.error).toBe("payment_method_required");
    expect(body).not.toHaveProperty("checkoutUrl");
    expect(body).not.toHaveProperty("billingUrl");
    expect(createCardOnFileSession).not.toHaveBeenCalled();
  });
});
