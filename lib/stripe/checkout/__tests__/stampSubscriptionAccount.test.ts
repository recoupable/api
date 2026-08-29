import { describe, it, expect, vi, beforeEach } from "vitest";

const { subUpdateMock, cusUpdateMock } = vi.hoisted(() => ({
  subUpdateMock: vi.fn(),
  cusUpdateMock: vi.fn(),
}));
vi.mock("@/lib/stripe/client", () => ({
  default: { subscriptions: { update: subUpdateMock }, customers: { update: cusUpdateMock } },
}));

const { stampSubscriptionAccount } = await import("../stampSubscriptionAccount");

describe("stampSubscriptionAccount", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stamps accountId on the subscription and the customer, marking webhook-created accounts", async () => {
    await stampSubscriptionAccount({
      subscriptionId: "sub_1",
      customerId: "cus_1",
      accountId: "acc_1",
      createdBy: "stripe_webhook",
    });
    expect(subUpdateMock).toHaveBeenCalledWith("sub_1", {
      metadata: { accountId: "acc_1", created_by: "stripe_webhook" },
    });
    expect(cusUpdateMock).toHaveBeenCalledWith("cus_1", { metadata: { accountId: "acc_1" } });
  });

  it("clears the marker on a claim", async () => {
    await stampSubscriptionAccount({
      subscriptionId: "sub_1",
      customerId: "cus_1",
      accountId: "acc_2",
      createdBy: "",
    });
    expect(subUpdateMock.mock.calls[0][1].metadata.created_by).toBe("");
  });
});
