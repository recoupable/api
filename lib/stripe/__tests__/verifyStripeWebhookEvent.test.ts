import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { constructEventMock } = vi.hoisted(() => ({
  constructEventMock: vi.fn(),
}));

vi.mock("@/lib/stripe/client", () => ({
  default: {
    webhooks: { constructEvent: constructEventMock },
  },
}));

vi.mock("@/lib/stripe/config", () => ({
  STRIPE_WEBHOOK_SECRET: "whsec_test",
}));

const { verifyStripeWebhookEvent } = await import("@/lib/stripe/verifyStripeWebhookEvent");

const makeReq = (body: string, signature: string | null) =>
  new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: signature ? { "stripe-signature": signature } : {},
    body,
  });

describe("verifyStripeWebhookEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the constructed event when signature is valid", async () => {
    const ev = { id: "evt_1", type: "checkout.session.completed" };
    constructEventMock.mockReturnValue(ev);

    const result = await verifyStripeWebhookEvent(makeReq("{}", "sig"));
    expect(result).toEqual({ event: ev });
    expect(constructEventMock).toHaveBeenCalledWith("{}", "sig", "whsec_test");
  });

  it("returns an error when stripe-signature header is missing", async () => {
    const result = await verifyStripeWebhookEvent(makeReq("{}", null));
    expect(result).toEqual({ error: "Missing stripe-signature header" });
    expect(constructEventMock).not.toHaveBeenCalled();
  });

  it("returns an error when constructEvent throws", async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error("bad signature");
    });
    const result = await verifyStripeWebhookEvent(makeReq("{}", "sig"));
    expect(result).toEqual({ error: "Invalid Stripe signature" });
  });
});
