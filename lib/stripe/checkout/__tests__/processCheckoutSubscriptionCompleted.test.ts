import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

const { retrieveMock, findOrCreateMock, stampMock } = vi.hoisted(() => ({
  retrieveMock: vi.fn(),
  findOrCreateMock: vi.fn(),
  stampMock: vi.fn(),
}));
vi.mock("@/lib/stripe/client", () => ({ default: { subscriptions: { retrieve: retrieveMock } } }));
vi.mock("../findOrCreateAccountForCheckout", () => ({
  findOrCreateAccountForCheckout: findOrCreateMock,
}));
vi.mock("../stampSubscriptionAccount", () => ({ stampSubscriptionAccount: stampMock }));

const { processCheckoutSubscriptionCompleted } = await import(
  "../processCheckoutSubscriptionCompleted"
);

const session = (o: Record<string, unknown> = {}) =>
  ({
    id: "cs_1",
    mode: "subscription",
    subscription: "sub_1",
    customer: "cus_1",
    customer_details: { email: "Fan@Example.com" },
    metadata: { plan: "pro", source: "checkout_unauth" },
    ...o,
  }) as unknown as Stripe.Checkout.Session;

describe("processCheckoutSubscriptionCompleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    retrieveMock.mockResolvedValue({ id: "sub_1", metadata: {} });
    findOrCreateMock.mockResolvedValue({ accountId: "acc_new", created: true });
  });

  it("finds or creates the account by the lowercased billing email and stamps it", async () => {
    await processCheckoutSubscriptionCompleted(session());
    expect(findOrCreateMock).toHaveBeenCalledWith("fan@example.com");
    expect(stampMock).toHaveBeenCalledWith({
      subscriptionId: "sub_1",
      customerId: "cus_1",
      accountId: "acc_new",
      createdBy: "stripe_webhook",
    });
  });

  it("leaves the marker empty when the email already had an account", async () => {
    findOrCreateMock.mockResolvedValue({ accountId: "acc_old", created: false });
    await processCheckoutSubscriptionCompleted(session());
    expect(stampMock.mock.calls[0][0].createdBy).toBe("");
  });

  it("is idempotent: skips when the subscription already carries an accountId", async () => {
    retrieveMock.mockResolvedValue({ id: "sub_1", metadata: { accountId: "acc_x" } });
    await processCheckoutSubscriptionCompleted(session());
    expect(findOrCreateMock).not.toHaveBeenCalled();
    expect(stampMock).not.toHaveBeenCalled();
  });

  it("ignores payment-mode sessions, authenticated sessions, and sessions without an email", async () => {
    await processCheckoutSubscriptionCompleted(session({ mode: "payment" }));
    await processCheckoutSubscriptionCompleted(
      session({ metadata: { accountId: "acc_1", plan: "pro" } }),
    );
    await processCheckoutSubscriptionCompleted(
      session({ customer_details: null, customer_email: null }),
    );
    expect(retrieveMock).not.toHaveBeenCalled();
  });
});
