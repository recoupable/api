import { describe, it, expect, vi, beforeEach } from "vitest";
import { grantCreditsWithAudit } from "@/lib/supabase/credit_grants/grantCreditsWithAudit";
import supabase from "@/lib/supabase/serverClient";

vi.mock("@/lib/supabase/serverClient", () => ({
  default: { rpc: vi.fn() },
}));

const ACCOUNT = "11111111-1111-1111-1111-111111111111";
const ADMIN = "22222222-2222-2222-2222-222222222222";

const grantRow = {
  id: "33333333-3333-3333-3333-333333333333",
  account_id: ACCOUNT,
  granted_by: ADMIN,
  reason: "Trial headroom for the Aug 12 label demo",
  previous_credits: 12,
  remaining_credits: 9999,
  created_at: "2026-08-06T23:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("grantCreditsWithAudit", () => {
  it("calls the grant_credits_with_audit RPC with the right param names", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: grantRow, error: null } as never);

    await grantCreditsWithAudit({
      accountId: ACCOUNT,
      grantedBy: ADMIN,
      reason: "Trial headroom for the Aug 12 label demo",
      remainingCredits: 9999,
    });

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith("grant_credits_with_audit", {
      p_account_id: ACCOUNT,
      p_granted_by: ADMIN,
      p_reason: "Trial headroom for the Aug 12 label demo",
      p_remaining_credits: 9999,
    });
  });

  it("returns the recorded grant row", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: grantRow, error: null } as never);

    const result = await grantCreditsWithAudit({
      accountId: ACCOUNT,
      grantedBy: ADMIN,
      reason: "Trial headroom for the Aug 12 label demo",
      remainingCredits: 9999,
    });

    expect(result).toEqual(grantRow);
  });

  it("throws when the RPC errors, so a failed grant is never reported as a success", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: "violates foreign key constraint" },
    } as never);

    await expect(
      grantCreditsWithAudit({
        accountId: ACCOUNT,
        grantedBy: ADMIN,
        reason: "ok",
        remainingCredits: 100,
      }),
    ).rejects.toThrow();
  });

  it("throws when the RPC returns no row", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);

    await expect(
      grantCreditsWithAudit({
        accountId: ACCOUNT,
        grantedBy: ADMIN,
        reason: "ok",
        remainingCredits: 100,
      }),
    ).rejects.toThrow();
  });
});
