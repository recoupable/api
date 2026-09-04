import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateAutoTopUp } from "@/lib/supabase/credits_usage/updateAutoTopUp";
import serverClient from "@/lib/supabase/serverClient";

const { update, maybeSingle } = vi.hoisted(() => ({ update: vi.fn(), maybeSingle: vi.fn() }));

vi.mock("@/lib/supabase/serverClient", () => ({
  default: { from: vi.fn(() => ({ update })) },
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

beforeEach(() => {
  vi.clearAllMocks();
  update.mockReturnValue({
    eq: vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle })) })),
  });
});

describe("updateAutoTopUp", () => {
  it("writes the settings and clears last_error when enabling", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        account_id: ACCOUNT,
        auto_topup_enabled: true,
        auto_topup_amount: 100_000_000,
        auto_topup_threshold: 1_000_000,
        auto_topup_last_run_at: null,
        auto_topup_last_error: null,
        remaining_credits: 1,
      },
      error: null,
    });

    const row = await updateAutoTopUp({
      accountId: ACCOUNT,
      enabled: true,
      amountCredits: 100_000_000,
      thresholdCredits: 1_000_000,
    });

    expect(serverClient.from).toHaveBeenCalledWith("credits_usage");
    expect(update).toHaveBeenCalledWith({
      auto_topup_enabled: true,
      auto_topup_amount: 100_000_000,
      auto_topup_threshold: 1_000_000,
      auto_topup_last_error: null,
    });
    expect(row).toEqual({
      account_id: ACCOUNT,
      auto_topup_enabled: true,
      auto_topup_amount: 100_000_000,
      auto_topup_threshold: 1_000_000,
      auto_topup_last_run_at: null,
      auto_topup_last_error: null,
    });
  });

  it("keeps last_error when disabling", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        account_id: ACCOUNT,
        auto_topup_enabled: false,
        auto_topup_amount: 50_000_000,
        auto_topup_threshold: 0,
        auto_topup_last_run_at: null,
        auto_topup_last_error: "Your card was declined.",
      },
      error: null,
    });

    await updateAutoTopUp({
      accountId: ACCOUNT,
      enabled: false,
      amountCredits: 50_000_000,
      thresholdCredits: 0,
    });

    expect(update).toHaveBeenCalledWith({
      auto_topup_enabled: false,
      auto_topup_amount: 50_000_000,
      auto_topup_threshold: 0,
    });
  });

  it("returns null when no row matched", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(
      await updateAutoTopUp({
        accountId: ACCOUNT,
        enabled: false,
        amountCredits: 1,
        thresholdCredits: 0,
      }),
    ).toBeNull();
  });

  it("throws when Supabase returns an error", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(
      updateAutoTopUp({
        accountId: ACCOUNT,
        enabled: false,
        amountCredits: 1,
        thresholdCredits: 0,
      }),
    ).rejects.toEqual({ message: "boom" });
  });
});
