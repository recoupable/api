import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectAutoTopUp } from "@/lib/supabase/credits_usage/selectAutoTopUp";
import serverClient from "@/lib/supabase/serverClient";

const { maybeSingle } = vi.hoisted(() => ({ maybeSingle: vi.fn() }));

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
    })),
  },
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

beforeEach(() => vi.clearAllMocks());

describe("selectAutoTopUp", () => {
  it("returns the five auto top-up columns for the account", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        account_id: ACCOUNT,
        id: 1,
        remaining_credits: 5,
        timestamp: null,
        auto_topup_enabled: true,
        auto_topup_amount: 100_000_000,
        auto_topup_threshold: 1_000_000,
        auto_topup_last_run_at: null,
        auto_topup_last_error: null,
      },
      error: null,
    });

    const row = await selectAutoTopUp(ACCOUNT);

    expect(serverClient.from).toHaveBeenCalledWith("credits_usage");
    expect(row).toEqual({
      account_id: ACCOUNT,
      auto_topup_enabled: true,
      auto_topup_amount: 100_000_000,
      auto_topup_threshold: 1_000_000,
      auto_topup_last_run_at: null,
      auto_topup_last_error: null,
    });
  });

  it("returns null when the account has no row", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await selectAutoTopUp(ACCOUNT)).toBeNull();
  });

  it("throws when Supabase returns an error", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(selectAutoTopUp(ACCOUNT)).rejects.toEqual({ message: "boom" });
  });
});
