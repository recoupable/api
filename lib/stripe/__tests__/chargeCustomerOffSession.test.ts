import { describe, it, expect, vi, beforeEach } from "vitest";
import Stripe from "stripe";

const { paymentIntentsCreate, findDefaultPmMock } = vi.hoisted(() => ({
  paymentIntentsCreate: vi.fn(),
  findDefaultPmMock: vi.fn(),
}));

vi.mock("@/lib/stripe/client", () => ({
  default: { paymentIntents: { create: paymentIntentsCreate } },
}));

vi.mock("@/lib/stripe/findDefaultPaymentMethodForCustomer", () => ({
  findDefaultPaymentMethodForCustomer: findDefaultPmMock,
}));

const { chargeCustomerOffSession } = await import("@/lib/stripe/chargeCustomerOffSession");

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

const params = {
  customer: "cus_x",
  totalCents: 289,
  metadata: { accountId: ACCOUNT, credits: "250", purpose: "credits_topup" },
};

describe("chargeCustomerOffSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("returns no_payment_method when the Customer has no saved card", async () => {
    findDefaultPmMock.mockResolvedValue(null);

    const result = await chargeCustomerOffSession(params);
    expect(result).toEqual({ kind: "no_payment_method" });
    expect(paymentIntentsCreate).not.toHaveBeenCalled();
  });

  it("creates an off-session PaymentIntent and returns kind=charged on success", async () => {
    findDefaultPmMock.mockResolvedValue("pm_card");
    paymentIntentsCreate.mockResolvedValue({
      id: "pi_ok",
      status: "succeeded",
    });

    const result = await chargeCustomerOffSession(params);

    expect(result).toEqual({ kind: "charged", paymentIntentId: "pi_ok" });
    expect(paymentIntentsCreate).toHaveBeenCalledWith({
      amount: 289,
      currency: "usd",
      customer: "cus_x",
      payment_method: "pm_card",
      confirm: true,
      off_session: true,
      metadata: {
        accountId: ACCOUNT,
        credits: "250",
        purpose: "credits_topup",
        paymentMethod: "off_session",
      },
    });
  });

  it("does NOT pass an idempotency key so same-amount top-ups produce distinct PaymentIntents", async () => {
    findDefaultPmMock.mockResolvedValue("pm_card");
    paymentIntentsCreate.mockResolvedValue({ id: "pi_a", status: "succeeded" });
    await chargeCustomerOffSession(params);
    expect(paymentIntentsCreate.mock.calls[0]).toHaveLength(1);
  });

  it("returns requires_action when Stripe throws StripeCardError with authentication_required", async () => {
    findDefaultPmMock.mockResolvedValue("pm_card");
    paymentIntentsCreate.mockRejectedValue(
      new Stripe.errors.StripeCardError({
        type: "card_error",
        code: "authentication_required",
        message: "Authentication required",
      }),
    );

    const result = await chargeCustomerOffSession(params);
    expect(result).toEqual({
      kind: "requires_action",
      declineReason: {
        code: "authentication_required",
        message: "Authentication required",
      },
    });
  });

  it("returns requires_action plus declineReason for any StripeCardError code (declined, expired, fraud)", async () => {
    findDefaultPmMock.mockResolvedValue("pm_card");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    paymentIntentsCreate.mockRejectedValue(
      new Stripe.errors.StripeCardError({
        type: "card_error",
        code: "card_declined",
        decline_code: "insufficient_funds",
        message: "Your card has insufficient funds.",
      }),
    );
    expect(await chargeCustomerOffSession(params)).toEqual({
      kind: "requires_action",
      declineReason: {
        code: "card_declined",
        declineCode: "insufficient_funds",
        message: "Your card has insufficient funds.",
      },
    });

    paymentIntentsCreate.mockRejectedValue(
      new Stripe.errors.StripeCardError({
        type: "card_error",
        code: "expired_card",
        message: "Your card has expired.",
      }),
    );
    expect(await chargeCustomerOffSession(params)).toEqual({
      kind: "requires_action",
      declineReason: {
        code: "expired_card",
        message: "Your card has expired.",
      },
    });
  });

  it("returns requires_action when Stripe throws StripeInvalidRequestError (e.g. customer has no payment method)", async () => {
    findDefaultPmMock.mockResolvedValue("pm_card");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    paymentIntentsCreate.mockRejectedValue(
      new Stripe.errors.StripeInvalidRequestError({
        type: "invalid_request_error",
        message: "Customer has no attached payment source or default payment method",
      }),
    );

    const result = await chargeCustomerOffSession(params);
    expect(result).toEqual({ kind: "requires_action" });
  });

  it("returns requires_action when the PaymentIntent comes back as requires_action", async () => {
    findDefaultPmMock.mockResolvedValue("pm_card");
    paymentIntentsCreate.mockResolvedValue({
      id: "pi_needs_3ds",
      status: "requires_action",
    });

    const result = await chargeCustomerOffSession(params);
    expect(result).toEqual({ kind: "requires_action" });
  });

  it("only treats status=succeeded as charged — other non-success statuses fall through to requires_action", async () => {
    findDefaultPmMock.mockResolvedValue("pm_card");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    for (const status of [
      "processing",
      "requires_capture",
      "canceled",
      "requires_payment_method",
    ]) {
      paymentIntentsCreate.mockResolvedValue({ id: `pi_${status}`, status });
      const result = await chargeCustomerOffSession(params);
      expect(result).toEqual({ kind: "requires_action" });
    }
  });

  it("rethrows on unexpected hard errors", async () => {
    findDefaultPmMock.mockResolvedValue("pm_card");
    paymentIntentsCreate.mockRejectedValue(new Error("stripe-down"));

    await expect(chargeCustomerOffSession(params)).rejects.toThrow("stripe-down");
  });
});
