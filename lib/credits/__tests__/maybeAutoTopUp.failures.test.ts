import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { maybeAutoTopUp } from "@/lib/credits/maybeAutoTopUp";

const m = vi.hoisted(() => ({
  settings: vi.fn(),
  usage: vi.fn(),
  update: vi.fn(),
  customer: vi.fn(),
  charge: vi.fn(),
  email: vi.fn(),
  disable: vi.fn(),
}));
vi.mock("@/lib/billing/readAutoTopUpSettings", () => ({ readAutoTopUpSettings: m.settings }));
vi.mock("@/lib/supabase/credits_usage/selectCreditsUsage", () => ({ selectCreditsUsage: m.usage }));
vi.mock("@/lib/supabase/credits_usage/updateCreditsUsage", () => ({
  updateCreditsUsage: m.update,
}));
vi.mock("@/lib/stripe/findStripeCustomerForAccount", () => ({
  findStripeCustomerForAccount: m.customer,
}));
vi.mock("@/lib/stripe/chargeCustomerOffSession", () => ({ chargeCustomerOffSession: m.charge }));
vi.mock("@/lib/stripe/getDefaultPaymentMethodDetails", () => ({
  getDefaultPaymentMethodDetails: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/credits/sendAutoTopUpEmail", () => ({ sendAutoTopUpEmail: m.email }));
vi.mock("@/lib/credits/disableAutoTopUpAfterFailure", () => ({
  disableAutoTopUpAfterFailure: m.disable,
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const NOW = new Date("2026-09-05T12:00:00.000Z");
const settings = (over: Record<string, unknown> = {}) => ({
  account_id: ACCOUNT,
  auto_topup_enabled: true,
  auto_topup_amount: 5_000_000,
  auto_topup_threshold: 1_000_000,
  auto_topup_last_run_at: null,
  auto_topup_last_error: null,
  ...over,
});

describe("maybeAutoTopUp failures and pending", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    m.usage.mockResolvedValue([{ account_id: ACCOUNT, remaining_credits: 500_000 }]);
    m.update.mockResolvedValue({});
    m.customer.mockResolvedValue("cus_1");
    m.charge.mockResolvedValue({ kind: "charged", paymentIntentId: "pi_1" });
  });
  afterEach(() => vi.restoreAllMocks());

  it("hands a decline to disableAutoTopUpAfterFailure with the stamp it wrote", async () => {
    m.settings.mockResolvedValue(settings());
    m.charge.mockResolvedValue({
      kind: "requires_action",
      declineReason: { message: "Your card was declined." },
    });
    m.disable.mockResolvedValue({ kind: "disabled", message: "Your card was declined." });
    const out = await maybeAutoTopUp({ accountId: ACCOUNT, now: NOW });
    expect(m.disable).toHaveBeenCalledWith({
      accountId: ACCOUNT,
      amountCents: 500,
      message: "Your card was declined.",
      stamp: NOW.toISOString(),
    });
    expect(out).toEqual({ kind: "disabled", message: "Your card was declined." });
  });

  it("uses the fallback message when a decline carries none", async () => {
    m.settings.mockResolvedValue(settings());
    m.charge.mockResolvedValue({ kind: "requires_action" });
    m.disable.mockResolvedValue({ kind: "disabled", message: "The card could not be charged" });
    await maybeAutoTopUp({ accountId: ACCOUNT, now: NOW });
    expect(m.disable).toHaveBeenCalledWith(
      expect.objectContaining({ message: "The card could not be charged" }),
    );
  });

  it("maps no_payment_method from Stripe to the no-card outcome", async () => {
    m.settings.mockResolvedValue(settings());
    m.charge.mockResolvedValue({ kind: "no_payment_method" });
    m.disable.mockResolvedValue({ kind: "disabled", message: "No card on file" });
    const out = await maybeAutoTopUp({ accountId: ACCOUNT, now: NOW });
    expect(m.disable).toHaveBeenCalledWith(expect.objectContaining({ message: "No card on file" }));
    expect(out).toEqual({ kind: "disabled", message: "No card on file" });
  });

  it("reports pending without disabling when Stripe is still processing the charge", async () => {
    m.settings.mockResolvedValue(settings());
    m.charge.mockResolvedValue({ kind: "pending", paymentIntentId: "pi_p" });
    const out = await maybeAutoTopUp({ accountId: ACCOUNT, now: NOW });
    expect(out).toEqual({ kind: "pending", paymentIntentId: "pi_p" });
    expect(m.update).toHaveBeenCalledTimes(1);
    expect(m.email).not.toHaveBeenCalled();
  });

  it("disables when the account has no Stripe customer", async () => {
    m.settings.mockResolvedValue(settings());
    m.customer.mockResolvedValue(null);
    m.disable.mockResolvedValue({ kind: "disabled", message: "No card on file" });
    const out = await maybeAutoTopUp({ accountId: ACCOUNT, now: NOW });
    expect(m.charge).not.toHaveBeenCalled();
    expect(m.disable).toHaveBeenCalledWith(
      expect.objectContaining({ message: "No card on file", stamp: NOW.toISOString() }),
    );
    expect(out).toEqual({ kind: "disabled", message: "No card on file" });
  });
});
