import { describe, it, expect, vi, beforeEach } from "vitest";

const { checkoutSessionsCreate, resolveStripeCustomerForAccountMock } = vi.hoisted(() => ({
  checkoutSessionsCreate: vi.fn(),
  resolveStripeCustomerForAccountMock: vi.fn(),
}));

vi.mock("@/lib/stripe/client", () => ({
  default: { checkout: { sessions: { create: checkoutSessionsCreate } } },
}));
vi.mock("@/lib/stripe/resolveStripeCustomerForAccount", () => ({
  resolveStripeCustomerForAccount: resolveStripeCustomerForAccountMock,
}));

const { createCardOnFileSession } = await import("@/lib/stripe/createCardOnFileSession");

describe("createCardOnFileSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkoutSessionsCreate.mockResolvedValue({ id: "cs_x", url: "https://checkout/setup" });
    resolveStripeCustomerForAccountMock.mockResolvedValue("cus_acc1");
  });

  it("creates a setup-mode session (collect card only, no subscription/price)", async () => {
    await createCardOnFileSession("acc-1", "https://example.com/success");

    expect(resolveStripeCustomerForAccountMock).toHaveBeenCalledWith("acc-1");
    const params = checkoutSessionsCreate.mock.calls[0][0];
    expect(params).toMatchObject({
      customer: "cus_acc1",
      mode: "setup",
      client_reference_id: "acc-1",
      success_url: "https://example.com/success",
    });
    // free tier: no subscription, no line_items/price
    expect(params.mode).not.toBe("subscription");
    expect(params.line_items).toBeUndefined();
  });
});
