import { beforeEach, describe, expect, it, vi } from "vitest";
import supabase from "@/lib/supabase/serverClient";
import { selectCreditsUsage } from "../selectCreditsUsage";
import { incrementRemainingCredits } from "../incrementRemainingCredits";
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc: vi.fn() } }));
vi.mock("../selectCreditsUsage", () => ({ selectCreditsUsage: vi.fn() }));
const accountId = "123e4567-e89b-12d3-a456-426614174000";
describe("atomic legacy topups", () => {
  beforeEach(() => vi.clearAllMocks());
  it("adds atomically and preserves the existing wallet-row return contract", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { remainingCredits: 300 },
      error: null,
    } as never);
    vi.mocked(selectCreditsUsage).mockResolvedValue([
      { id: 1, account_id: accountId, remaining_credits: 300, timestamp: "2026-10-20" },
    ] as never);
    const row = await incrementRemainingCredits({ accountId, delta: 250 });
    expect(supabase.rpc).toHaveBeenCalledWith("increment_credits_atomic", {
      p_account_id: accountId,
      p_delta: 250,
    });
    expect(row.remaining_credits).toBe(300);
    expect(row.id).toBe(1);
  });
  it("rejects nonpositive increments before touching the wallet", async () => {
    await expect(incrementRemainingCredits({ accountId, delta: 0 })).rejects.toThrow("positive");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
  it("propagates a controlled missing-wallet error", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: "No credits usage found" },
    } as never);
    await expect(incrementRemainingCredits({ accountId, delta: 100 })).rejects.toThrow(
      "No credits usage",
    );
  });
});
