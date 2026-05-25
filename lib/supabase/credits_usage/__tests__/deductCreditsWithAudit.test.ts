import { describe, it, expect, vi, beforeEach } from "vitest";
import { deductCreditsWithAudit } from "@/lib/supabase/credits_usage/deductCreditsWithAudit";
import supabase from "@/lib/supabase/serverClient";

vi.mock("@/lib/supabase/serverClient", () => ({
  default: { rpc: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const ACCOUNT = "11111111-1111-1111-1111-111111111111";
const validEvent = {
  source: "api" as const,
  agent_type: "main" as const,
  provider: "anthropic",
  model_id: "anthropic/claude-haiku-4.5",
  input_tokens: 42,
  cached_input_tokens: 10,
  output_tokens: 13,
  tool_call_count: 1,
};

describe("deductCreditsWithAudit", () => {
  it("calls the deduct_credits_with_audit RPC with the right param names", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);

    await deductCreditsWithAudit({
      accountId: ACCOUNT,
      cents: 7,
      eventId: "evt_abc",
      event: validEvent,
    });

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith("deduct_credits_with_audit", {
      p_account_id: ACCOUNT,
      p_amount: 7,
      p_event_id: "evt_abc",
      p_event: validEvent,
    });
  });

  it("returns { ok: true } when the RPC succeeds", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);

    const result = await deductCreditsWithAudit({
      accountId: ACCOUNT,
      cents: 7,
      eventId: "evt_abc",
      event: validEvent,
    });

    expect(result).toEqual({ ok: true });
  });

  it("returns { ok: false, error } when the RPC returns an error (does NOT throw)", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: "credits_usage row not found" },
    } as never);

    const result = await deductCreditsWithAudit({
      accountId: ACCOUNT,
      cents: 7,
      eventId: "evt_abc",
      event: validEvent,
    });

    expect(result).toEqual({ ok: false, error: "credits_usage row not found" });
  });

  it("returns { ok: false, error } when the rpc call throws (network failure)", async () => {
    vi.mocked(supabase.rpc).mockRejectedValue(new Error("network blip"));

    const result = await deductCreditsWithAudit({
      accountId: ACCOUNT,
      cents: 7,
      eventId: "evt_abc",
      event: validEvent,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("network blip");
    }
  });
});
