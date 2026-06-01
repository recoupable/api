import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";

const { deductCreditsWithAuditMock } = vi.hoisted(() => ({
  deductCreditsWithAuditMock: vi.fn(),
}));

vi.mock("@/lib/supabase/credits_usage/deductCreditsWithAudit", () => ({
  deductCreditsWithAudit: deductCreditsWithAuditMock,
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

describe("recordCreditDeduction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls the atomic RPC with cents + event payload carrying token detail", async () => {
    deductCreditsWithAuditMock.mockResolvedValue({ ok: true });

    const result = await recordCreditDeduction({
      accountId: ACCOUNT,
      creditsToDeduct: 250,
      source: "web",
      modelId: "claude-haiku-4-5",
      provider: "anthropic",
      inputTokens: 1234,
      outputTokens: 567,
      cachedInputTokens: 890,
      toolCallCount: 3,
    });

    expect(deductCreditsWithAuditMock).toHaveBeenCalledTimes(1);
    const args = deductCreditsWithAuditMock.mock.calls[0]?.[0];
    expect(args.accountId).toBe(ACCOUNT);
    expect(args.cents).toBe(250);
    expect(typeof args.eventId).toBe("string");
    expect(args.eventId.length).toBeGreaterThan(0);
    expect(args.event).toEqual({
      source: "web",
      agent_type: "main",
      provider: "anthropic",
      model_id: "claude-haiku-4-5",
      input_tokens: 1234,
      cached_input_tokens: 890,
      output_tokens: 567,
      tool_call_count: 3,
    });
    expect(result).toEqual({ success: true });
  });

  it("applies defaults (agent_type='main', zero tokens, undefined model/provider) when token detail is omitted", async () => {
    deductCreditsWithAuditMock.mockResolvedValue({ ok: true });

    await recordCreditDeduction({
      accountId: ACCOUNT,
      creditsToDeduct: 5,
      source: "api",
    });

    const args = deductCreditsWithAuditMock.mock.calls[0]?.[0];
    expect(args.event).toEqual({
      source: "api",
      agent_type: "main",
      provider: undefined,
      model_id: undefined,
      input_tokens: 0,
      cached_input_tokens: 0,
      output_tokens: 0,
      tool_call_count: 0,
    });
  });

  it("returns { success: false } and logs when the RPC reports an error (does NOT throw)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    deductCreditsWithAuditMock.mockResolvedValue({
      ok: false,
      error: "credits_usage row not found",
    });

    const result = await recordCreditDeduction({
      accountId: ACCOUNT,
      creditsToDeduct: 50,
      source: "web",
    });

    expect(result).toEqual({ success: false });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("does not throw when the RPC wrapper itself rejects (defense in depth)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    deductCreditsWithAuditMock.mockRejectedValue(new Error("network blip"));

    const result = await recordCreditDeduction({
      accountId: ACCOUNT,
      creditsToDeduct: 5,
      source: "web",
    });

    expect(result).toEqual({ success: false });
    consoleSpy.mockRestore();
  });
});
