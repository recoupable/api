import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { maybeAutoTopUp } from "@/lib/credits/maybeAutoTopUp";

const m = vi.hoisted(() => ({
  readAutoTopUpSettings: vi.fn(),
  selectCreditsUsage: vi.fn(),
  claimLease: vi.fn(),
  findCustomer: vi.fn(),
  charge: vi.fn(),
  failure: vi.fn(),
  email: vi.fn(),
}));

vi.mock("@/lib/billing/readAutoTopUpSettings", () => ({
  readAutoTopUpSettings: m.readAutoTopUpSettings,
}));
vi.mock("@/lib/supabase/credits_usage/selectCreditsUsage", () => ({
  selectCreditsUsage: m.selectCreditsUsage,
}));
vi.mock("@/lib/supabase/credits_usage/claimAutoTopUpLease", () => ({
  claimAutoTopUpLease: m.claimLease,
}));
vi.mock("@/lib/stripe/findStripeCustomerForAccount", () => ({
  findStripeCustomerForAccount: m.findCustomer,
}));
vi.mock("@/lib/stripe/chargeCustomerOffSession", () => ({ chargeCustomerOffSession: m.charge }));
vi.mock("@/lib/supabase/credits_usage/updateAutoTopUpFailure", () => ({
  updateAutoTopUpFailure: m.failure,
}));
vi.mock("@/lib/credits/sendAutoTopUpEmail", () => ({ sendAutoTopUpEmail: m.email }));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const NOW = new Date("2026-09-04T15:00:00Z");
const STAMP = "2026-09-04T15:00:00.000Z";
const LEASE = { stamp: STAMP, amountCredits: 100_000_000 };

const settings = {
  account_id: ACCOUNT,
  auto_topup_enabled: true,
  auto_topup_amount: 100_000_000,
  auto_topup_threshold: 1_000_000,
  auto_topup_last_run_at: null,
  auto_topup_last_error: null,
};

afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  m.readAutoTopUpSettings.mockResolvedValue(settings);
  m.selectCreditsUsage.mockResolvedValue([{ account_id: ACCOUNT, remaining_credits: 500_000 }]);
  m.claimLease.mockResolvedValue(LEASE);
  m.findCustomer.mockResolvedValue("cus_x");
  m.charge.mockResolvedValue({ kind: "charged", paymentIntentId: "pi_1" });
  m.failure.mockResolvedValue(undefined);
  m.email.mockResolvedValue(undefined);
});

describe("maybeAutoTopUp", () => {
  it("claims the lease with the settings it read, charges as a credits_topup so the webhook grants, and emails a receipt", async () => {
    const result = await maybeAutoTopUp({ accountId: ACCOUNT, now: NOW });

    expect(result).toEqual({ kind: "charged", paymentIntentId: "pi_1" });
    expect(m.claimLease).toHaveBeenCalledWith({
      accountId: ACCOUNT,
      now: NOW,
      amountCredits: 100_000_000,
      thresholdCredits: 1_000_000,
    });
    expect(m.charge).toHaveBeenCalledWith({
      customer: "cus_x",
      totalCents: 10000,
      metadata: {
        accountId: ACCOUNT,
        credits: "100000000",
        purpose: "credits_topup",
        trigger: "auto_topup",
      },
      idempotencyKey: `autotopup:${ACCOUNT}:${STAMP}`,
    });
    expect(m.email).toHaveBeenCalledWith({
      accountId: ACCOUNT,
      kind: "receipt",
      amountCents: 10000,
    });
    expect(m.failure).not.toHaveBeenCalled();
  });

  it("skips without touching Stripe when auto top-up is off", async () => {
    m.readAutoTopUpSettings.mockResolvedValue({ ...settings, auto_topup_enabled: false });
    expect(await maybeAutoTopUp({ accountId: ACCOUNT, now: NOW })).toEqual({ kind: "skipped" });
    expect(m.claimLease).not.toHaveBeenCalled();
    expect(m.charge).not.toHaveBeenCalled();
  });

  it("skips when the account has no settings row", async () => {
    m.readAutoTopUpSettings.mockResolvedValue(null);
    expect(await maybeAutoTopUp({ accountId: ACCOUNT, now: NOW })).toEqual({ kind: "skipped" });
  });

  it("skips when the balance is still at or above the threshold", async () => {
    m.selectCreditsUsage.mockResolvedValue([{ account_id: ACCOUNT, remaining_credits: 1_000_000 }]);
    expect(await maybeAutoTopUp({ accountId: ACCOUNT, now: NOW })).toEqual({ kind: "skipped" });
    expect(m.claimLease).not.toHaveBeenCalled();
  });

  it("skips when another deduction already holds the 10-minute lease", async () => {
    m.claimLease.mockResolvedValue(null);
    expect(await maybeAutoTopUp({ accountId: ACCOUNT, now: NOW })).toEqual({ kind: "skipped" });
    expect(m.charge).not.toHaveBeenCalled();
  });

  it("charges the amount the lease locked, not the amount it first read", async () => {
    m.claimLease.mockResolvedValue({ stamp: STAMP, amountCredits: 50_000_000 });
    await maybeAutoTopUp({ accountId: ACCOUNT, now: NOW });
    expect(m.charge).toHaveBeenCalledWith(
      expect.objectContaining({
        totalCents: 5000,
        metadata: expect.objectContaining({ credits: "50000000" }),
      }),
    );
  });

  it("on a decline: turns auto top-up off with the message, emails, and does not grant", async () => {
    m.charge.mockResolvedValue({
      kind: "requires_action",
      declineReason: { code: "card_declined", message: "Your card was declined." },
    });

    const result = await maybeAutoTopUp({ accountId: ACCOUNT, now: NOW });

    expect(result).toEqual({ kind: "disabled", message: "Your card was declined." });
    expect(m.failure).toHaveBeenCalledWith({
      accountId: ACCOUNT,
      message: "Your card was declined.",
    });
    expect(m.email).toHaveBeenCalledWith({
      accountId: ACCOUNT,
      kind: "declined",
      amountCents: 10000,
      message: "Your card was declined.",
    });
  });

  it("on no card on file: turns auto top-up off and emails", async () => {
    m.charge.mockResolvedValue({ kind: "no_payment_method" });
    const result = await maybeAutoTopUp({ accountId: ACCOUNT, now: NOW });
    expect(result).toEqual({ kind: "disabled", message: "No card on file" });
    expect(m.failure).toHaveBeenCalledWith({ accountId: ACCOUNT, message: "No card on file" });
  });

  it("on no Stripe customer: turns auto top-up off without calling Stripe", async () => {
    m.findCustomer.mockResolvedValue(null);
    const result = await maybeAutoTopUp({ accountId: ACCOUNT, now: NOW });
    expect(result).toEqual({ kind: "disabled", message: "No card on file" });
    expect(m.charge).not.toHaveBeenCalled();
  });

  it("never throws: an unexpected error is logged and reported as error", async () => {
    m.charge.mockRejectedValue(new Error("stripe down"));
    const result = await maybeAutoTopUp({ accountId: ACCOUNT, now: NOW });
    expect(result).toEqual({ kind: "error" });
    expect(console.error).toHaveBeenCalled();
  });
});
