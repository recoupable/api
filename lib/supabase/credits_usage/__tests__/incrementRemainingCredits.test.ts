import { describe, it, expect, vi, beforeEach } from "vitest";
import { ZodError } from "zod";
import supabase from "@/lib/supabase/serverClient";
import { incrementRemainingCredits } from "@/lib/supabase/credits_usage/incrementRemainingCredits";

vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc: vi.fn(), from: vi.fn() } }));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

describe("incrementRemainingCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not read the balance before writing: one atomic RPC adds the delta", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { remainingCredits: 300 },
      error: null,
    } as never);

    const result = await incrementRemainingCredits({ accountId: ACCOUNT, delta: 250 });

    // A select-then-update would lose a concurrent debit or refill between the two
    // statements; the top-up must be added in place by the database.
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledOnce();
    expect(supabase.rpc).toHaveBeenCalledWith("increment_credits_atomic", {
      p_account_id: ACCOUNT,
      p_delta: 250,
    });
    expect(result).toEqual({ remainingCredits: 300 });
  });

  it("throws the database error when the wallet is missing or ambiguous", async () => {
    const error = { message: "Credit wallet is unavailable or ambiguous" };
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error } as never);

    await expect(incrementRemainingCredits({ accountId: ACCOUNT, delta: 100 })).rejects.toBe(error);
    expect(supabase.rpc).toHaveBeenCalledOnce();
  });

  it.each([null, { remainingCredits: "300" }, { remainingCredits: 300, timestamp: "x" }])(
    "rejects an invalid receipt with a validation error: %j",
    async data => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data, error: null } as never);

      await expect(
        incrementRemainingCredits({ accountId: ACCOUNT, delta: 100 }),
      ).rejects.toBeInstanceOf(ZodError);
    },
  );

  it("rejects non-positive or non-integer delta before touching the wallet", async () => {
    for (const delta of [0, -5, 1.5, Number.NaN]) {
      await expect(incrementRemainingCredits({ accountId: ACCOUNT, delta })).rejects.toThrow(
        /positive integer/,
      );
    }
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
