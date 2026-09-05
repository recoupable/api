import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { maybeAutoTopUp } from "@/lib/credits/maybeAutoTopUp";

const m = vi.hoisted(() => ({
  settings: vi.fn(),
  usage: vi.fn(),
  update: vi.fn(),
  charge: vi.fn(),
}));
vi.mock("@/lib/billing/readAutoTopUpSettings", () => ({ readAutoTopUpSettings: m.settings }));
vi.mock("@/lib/supabase/credits_usage/selectCreditsUsage", () => ({ selectCreditsUsage: m.usage }));
vi.mock("@/lib/supabase/credits_usage/updateCreditsUsage", () => ({
  updateCreditsUsage: m.update,
}));
vi.mock("@/lib/stripe/findStripeCustomerForAccount", () => ({
  findStripeCustomerForAccount: vi.fn(),
}));
vi.mock("@/lib/stripe/chargeCustomerOffSession", () => ({ chargeCustomerOffSession: m.charge }));
vi.mock("@/lib/stripe/getDefaultPaymentMethodDetails", () => ({
  getDefaultPaymentMethodDetails: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/credits/sendAutoTopUpEmail", () => ({ sendAutoTopUpEmail: vi.fn() }));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const NOW = new Date("2026-09-05T12:00:00.000Z");
const enabled = {
  account_id: ACCOUNT,
  auto_topup_enabled: true,
  auto_topup_amount: 5_000_000,
  auto_topup_threshold: 1_000_000,
  auto_topup_last_run_at: null,
  auto_topup_last_error: null,
};

describe("maybeAutoTopUp skips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    m.usage.mockResolvedValue([{ account_id: ACCOUNT, remaining_credits: 500_000 }]);
  });
  afterEach(() => vi.restoreAllMocks());

  const expectSkip = async () => {
    expect(await maybeAutoTopUp({ accountId: ACCOUNT, now: NOW })).toEqual({ kind: "skipped" });
    expect(m.update).not.toHaveBeenCalled();
    expect(m.charge).not.toHaveBeenCalled();
  };

  it("when the account has no settings row", async () => {
    m.settings.mockResolvedValue(null);
    await expectSkip();
  });
  it("when auto top-up is off", async () => {
    m.settings.mockResolvedValue({ ...enabled, auto_topup_enabled: false });
    await expectSkip();
  });
  it("when the balance is at or above the threshold", async () => {
    m.settings.mockResolvedValue(enabled);
    m.usage.mockResolvedValue([{ account_id: ACCOUNT, remaining_credits: 1_000_000 }]);
    await expectSkip();
  });
  it("within ten minutes of the last run", async () => {
    m.settings.mockResolvedValue({
      ...enabled,
      auto_topup_last_run_at: "2026-09-05T11:55:00.000Z",
    });
    await expectSkip();
  });
});
