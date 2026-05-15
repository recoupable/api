import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";

const { deductCreditsMock, insertUsageEventMock } = vi.hoisted(() => ({
  deductCreditsMock: vi.fn(),
  insertUsageEventMock: vi.fn(),
}));

vi.mock("@/lib/credits/deductCredits", () => ({
  deductCredits: deductCreditsMock,
}));

vi.mock("@/lib/supabase/usage_events/insertUsageEvent", () => ({
  insertUsageEvent: insertUsageEventMock,
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

describe("recordCreditDeduction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deducts credits then inserts a usage_events row carrying token detail", async () => {
    deductCreditsMock.mockResolvedValue({ success: true, newBalance: 100 });
    insertUsageEventMock.mockResolvedValue({ id: "abc" });

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

    expect(deductCreditsMock).toHaveBeenCalledWith({
      accountId: ACCOUNT,
      creditsToDeduct: 250,
    });
    expect(insertUsageEventMock).toHaveBeenCalledWith({
      account_id: ACCOUNT,
      credits_deducted_cents: 250,
      source: "web",
      agent_type: "main",
      provider: "anthropic",
      model_id: "claude-haiku-4-5",
      input_tokens: 1234,
      cached_input_tokens: 890,
      output_tokens: 567,
      tool_call_count: 3,
    });
    expect(result).toEqual({ success: true, newBalance: 100 });
  });

  it("applies defaults (agent_type='main', zero tokens, null model/provider) when token detail is omitted", async () => {
    deductCreditsMock.mockResolvedValue({ success: true, newBalance: 95 });
    insertUsageEventMock.mockResolvedValue({ id: "abc" });

    await recordCreditDeduction({
      accountId: ACCOUNT,
      creditsToDeduct: 5,
      source: "api",
    });

    expect(insertUsageEventMock).toHaveBeenCalledWith({
      account_id: ACCOUNT,
      credits_deducted_cents: 5,
      source: "api",
      agent_type: "main",
      provider: null,
      model_id: null,
      input_tokens: 0,
      cached_input_tokens: 0,
      output_tokens: 0,
      tool_call_count: 0,
    });
  });

  it("does not insert the audit row when the wallet deduction fails", async () => {
    deductCreditsMock.mockRejectedValue(new Error("Insufficient credits"));

    await expect(
      recordCreditDeduction({
        accountId: ACCOUNT,
        creditsToDeduct: 50,
        source: "web",
      }),
    ).rejects.toThrow(/Insufficient credits/);

    expect(insertUsageEventMock).not.toHaveBeenCalled();
  });

  it("returns the deduction result even if the audit insert fails (logs and swallows)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    deductCreditsMock.mockResolvedValue({ success: true, newBalance: 100 });
    insertUsageEventMock.mockRejectedValue(new Error("db down"));

    const result = await recordCreditDeduction({
      accountId: ACCOUNT,
      creditsToDeduct: 5,
      source: "api",
    });

    expect(result).toEqual({ success: true, newBalance: 100 });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
