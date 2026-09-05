import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { maybeAutoTopUp } from "@/lib/credits/maybeAutoTopUp";

const m = vi.hoisted(() => ({
  settings: vi.fn(),
  usage: vi.fn(),
  update: vi.fn(),
  customer: vi.fn(),
  charge: vi.fn(),
  email: vi.fn(),
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
vi.mock("@/lib/credits/sendAutoTopUpEmail", () => ({ sendAutoTopUpEmail: m.email }));

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

describe("maybeAutoTopUp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    m.usage.mockResolvedValue([{ account_id: ACCOUNT, remaining_credits: 500_000 }]);
    m.update.mockResolvedValue({});
    m.customer.mockResolvedValue("cus_1");
    m.charge.mockResolvedValue({ kind: "charged", paymentIntentId: "pi_1" });
  });
  afterEach(() => vi.restoreAllMocks());

  it("stamps last_run_at, then charges with the credits_topup purpose and a key from the previous stamp", async () => {
    m.settings.mockResolvedValue(settings());
    const out = await maybeAutoTopUp({ accountId: ACCOUNT, now: NOW });
    expect(m.update).toHaveBeenCalledWith({
      account_id: ACCOUNT,
      updates: { auto_topup_last_run_at: NOW.toISOString() },
    });
    expect(m.charge).toHaveBeenCalledWith({
      customer: "cus_1",
      totalCents: 500,
      metadata: {
        accountId: ACCOUNT,
        credits: "5000000",
        purpose: "credits_topup",
        trigger: "auto_topup",
      },
      idempotencyKey: `autotopup:${ACCOUNT}:first`,
    });
    expect(m.email).toHaveBeenCalledWith({ accountId: ACCOUNT, kind: "receipt", amountCents: 500 });
    expect(out).toEqual({ kind: "charged", paymentIntentId: "pi_1" });
  });

  it("derives the idempotency key from the previous stamp so concurrent runs share it", async () => {
    m.settings.mockResolvedValue(settings({ auto_topup_last_run_at: "2026-09-05T11:00:00.000Z" }));
    await maybeAutoTopUp({ accountId: ACCOUNT, now: NOW });
    expect(m.charge.mock.calls[0][0].idempotencyKey).toBe(
      `autotopup:${ACCOUNT}:2026-09-05T11:00:00.000Z`,
    );
  });

  it("disables and emails on a decline, without charging again", async () => {
    m.settings.mockResolvedValue(settings());
    m.charge.mockResolvedValue({
      kind: "requires_action",
      declineReason: { message: "Your card was declined." },
    });
    const out = await maybeAutoTopUp({ accountId: ACCOUNT, now: NOW });
    expect(m.update).toHaveBeenLastCalledWith({
      account_id: ACCOUNT,
      updates: { auto_topup_enabled: false, auto_topup_last_error: "Your card was declined." },
    });
    expect(m.email).toHaveBeenCalledWith({
      accountId: ACCOUNT,
      kind: "declined",
      amountCents: 500,
      message: "Your card was declined.",
    });
    expect(out).toEqual({ kind: "disabled", message: "Your card was declined." });
  });

  it("disables when the account has no Stripe customer", async () => {
    m.settings.mockResolvedValue(settings());
    m.customer.mockResolvedValue(null);
    const out = await maybeAutoTopUp({ accountId: ACCOUNT, now: NOW });
    expect(m.charge).not.toHaveBeenCalled();
    expect(out).toEqual({ kind: "disabled", message: "No card on file" });
  });

  it("never throws: a failing stamp write is logged and reported as error", async () => {
    m.settings.mockResolvedValue(settings());
    m.update.mockRejectedValue(new Error("db down"));
    expect(await maybeAutoTopUp({ accountId: ACCOUNT, now: NOW })).toEqual({ kind: "error" });
    expect(m.charge).not.toHaveBeenCalled();
  });
});
