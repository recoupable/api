import { describe, it, expect, vi, beforeEach } from "vitest";

const { retrieveMock, stampMock } = vi.hoisted(() => ({
  retrieveMock: vi.fn(),
  stampMock: vi.fn(),
}));
vi.mock("@/lib/stripe/client", () => ({
  default: { checkout: { sessions: { retrieve: retrieveMock } } },
}));
vi.mock("@/lib/stripe/checkout/stampSubscriptionAccount", () => ({
  stampSubscriptionAccount: stampMock,
}));
vi.mock("@/lib/stripe/config", () => ({
  STRIPE_SUBSCRIPTION_PRICE_ID: "price_pro",
  STRIPE_SUBSCRIPTION_TRIAL_PERIOD_DAYS: 30,
  STRIPE_STARTER_PRICE_ID: "price_starter",
}));

const { claimSubscription } = await import("../claimSubscription");

const sessionWith = (metadata: Record<string, string>, price = "price_pro") => ({
  id: "cs_1",
  customer: "cus_1",
  subscription: { id: "sub_1", metadata, items: { data: [{ price: { id: price } }] } },
});

describe("claimSubscription", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stamps an unowned subscription to the caller", async () => {
    retrieveMock.mockResolvedValue(sessionWith({}));
    const result = await claimSubscription({ sessionId: "cs_1", accountId: "acc_me" });
    expect(retrieveMock).toHaveBeenCalledWith("cs_1", { expand: ["subscription"] });
    expect(stampMock).toHaveBeenCalledWith({
      subscriptionId: "sub_1",
      customerId: "cus_1",
      accountId: "acc_me",
      createdBy: "",
    });
    expect(result).toEqual({ status: "success", subscription_id: "sub_1", plan: "pro" });
  });

  it("re-stamps a subscription owned by the webhook placeholder account", async () => {
    retrieveMock.mockResolvedValue(
      sessionWith({ accountId: "acc_placeholder", created_by: "stripe_webhook" }, "price_starter"),
    );
    const result = await claimSubscription({ sessionId: "cs_1", accountId: "acc_me" });
    expect(stampMock).toHaveBeenCalled();
    expect(result).toEqual({ status: "success", subscription_id: "sub_1", plan: "starter" });
  });

  it("clears the placeholder marker when the caller already owns the webhook-created account", async () => {
    retrieveMock.mockResolvedValue(
      sessionWith({ accountId: "acc_me", created_by: "stripe_webhook" }),
    );
    expect(await claimSubscription({ sessionId: "cs_1", accountId: "acc_me" })).toMatchObject({
      status: "success",
    });
    expect(stampMock).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "acc_me", createdBy: "" }),
    );
  });

  it("is idempotent when the caller already owns it and refuses another signed-in owner", async () => {
    retrieveMock.mockResolvedValue(sessionWith({ accountId: "acc_me" }));
    expect(await claimSubscription({ sessionId: "cs_1", accountId: "acc_me" })).toMatchObject({
      status: "success",
    });
    expect(stampMock).not.toHaveBeenCalled();

    retrieveMock.mockResolvedValue(sessionWith({ accountId: "acc_other" }));
    expect(await claimSubscription({ sessionId: "cs_1", accountId: "acc_me" })).toEqual({
      status: "error",
      error: "already_claimed",
    });
  });

  it("reports an unknown session and a session without a subscription", async () => {
    retrieveMock.mockRejectedValue(
      Object.assign(new Error("No such checkout.session"), { code: "resource_missing" }),
    );
    expect(await claimSubscription({ sessionId: "cs_nope", accountId: "acc_me" })).toEqual({
      status: "error",
      error: "session_not_found",
    });
    retrieveMock.mockResolvedValue({ id: "cs_2", customer: "cus_1", subscription: null });
    expect(await claimSubscription({ sessionId: "cs_2", accountId: "acc_me" })).toEqual({
      status: "error",
      error: "no_subscription",
    });
  });
});
