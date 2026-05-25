import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordChatUsage } from "@/app/lib/workflows/recordChatUsage";
import { computeCreditsDeductedCents } from "@/lib/credits/computeCreditsDeductedCents";
import { deductCreditsWithAudit } from "@/lib/supabase/credits_usage/deductCreditsWithAudit";

vi.mock("@/lib/credits/computeCreditsDeductedCents", () => ({
  computeCreditsDeductedCents: vi.fn(),
}));
vi.mock("@/lib/supabase/credits_usage/deductCreditsWithAudit", () => ({
  deductCreditsWithAudit: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const ACCOUNT = "11111111-1111-1111-1111-111111111111";

function buildAssistantMessage(metadata: Record<string, unknown>) {
  return {
    id: "msg_abc",
    role: "assistant" as const,
    parts: [{ type: "text", text: "ok" }],
    metadata,
  };
}

describe("recordChatUsage", () => {
  it("computes cents from the gateway cost on responseMessage.metadata.totalMessageCost", async () => {
    vi.mocked(computeCreditsDeductedCents).mockResolvedValue(7);
    vi.mocked(deductCreditsWithAudit).mockResolvedValue({ ok: true });

    const message = buildAssistantMessage({
      totalMessageCost: 0.07,
      totalMessageUsage: {
        inputTokens: 100,
        cachedInputTokens: 10,
        outputTokens: 20,
      },
    });

    await recordChatUsage({
      accountId: ACCOUNT,
      modelId: "anthropic/claude-haiku-4.5",
      responseMessage: message as never,
    });

    expect(computeCreditsDeductedCents).toHaveBeenCalledWith(
      { inputTokens: 100, cachedInputTokens: 10, outputTokens: 20 },
      "anthropic/claude-haiku-4.5",
      0.07,
    );
  });

  it("calls deductCreditsWithAudit with the computed cents and a fresh event id", async () => {
    vi.mocked(computeCreditsDeductedCents).mockResolvedValue(42);
    vi.mocked(deductCreditsWithAudit).mockResolvedValue({ ok: true });

    const message = buildAssistantMessage({
      totalMessageCost: 0.42,
      totalMessageUsage: {
        inputTokens: 100,
        cachedInputTokens: 0,
        outputTokens: 200,
      },
    });

    await recordChatUsage({
      accountId: ACCOUNT,
      modelId: "anthropic/claude-haiku-4.5",
      responseMessage: message as never,
    });

    expect(deductCreditsWithAudit).toHaveBeenCalledTimes(1);
    const args = vi.mocked(deductCreditsWithAudit).mock.calls[0]?.[0];
    expect(args?.accountId).toBe(ACCOUNT);
    expect(args?.cents).toBe(42);
    expect(typeof args?.eventId).toBe("string");
    expect(args?.eventId.length).toBeGreaterThan(0);
    expect(args?.event).toMatchObject({
      source: "api",
      agent_type: "main",
      provider: "anthropic",
      model_id: "anthropic/claude-haiku-4.5",
      input_tokens: 100,
      cached_input_tokens: 0,
      output_tokens: 200,
    });
  });

  it("derives provider from modelId (everything before the first slash)", async () => {
    vi.mocked(computeCreditsDeductedCents).mockResolvedValue(5);
    vi.mocked(deductCreditsWithAudit).mockResolvedValue({ ok: true });

    const message = buildAssistantMessage({
      totalMessageCost: 0.05,
      totalMessageUsage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
    });

    await recordChatUsage({
      accountId: ACCOUNT,
      modelId: "openai/gpt-5.4",
      responseMessage: message as never,
    });

    const args = vi.mocked(deductCreditsWithAudit).mock.calls[0]?.[0];
    expect(args?.event.provider).toBe("openai");
    expect(args?.event.model_id).toBe("openai/gpt-5.4");
  });

  it("skips entirely when responseMessage is undefined (no usage to charge)", async () => {
    await recordChatUsage({
      accountId: ACCOUNT,
      modelId: "anthropic/claude-haiku-4.5",
      responseMessage: undefined,
    });

    expect(computeCreditsDeductedCents).not.toHaveBeenCalled();
    expect(deductCreditsWithAudit).not.toHaveBeenCalled();
  });

  it("skips entirely when responseMessage has no metadata at all", async () => {
    await recordChatUsage({
      accountId: ACCOUNT,
      modelId: "anthropic/claude-haiku-4.5",
      responseMessage: {
        id: "m",
        role: "assistant",
        parts: [{ type: "text", text: "x" }],
      } as never,
    });

    expect(computeCreditsDeductedCents).not.toHaveBeenCalled();
    expect(deductCreditsWithAudit).not.toHaveBeenCalled();
  });

  it("falls back to zero token counts when totalMessageUsage is missing (still charges the 1c floor)", async () => {
    vi.mocked(computeCreditsDeductedCents).mockResolvedValue(1);
    vi.mocked(deductCreditsWithAudit).mockResolvedValue({ ok: true });

    const message = buildAssistantMessage({
      totalMessageCost: 0.0001,
      // No totalMessageUsage on metadata
    });

    await recordChatUsage({
      accountId: ACCOUNT,
      modelId: "anthropic/claude-haiku-4.5",
      responseMessage: message as never,
    });

    expect(computeCreditsDeductedCents).toHaveBeenCalledWith(
      { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 },
      "anthropic/claude-haiku-4.5",
      0.0001,
    );
    const args = vi.mocked(deductCreditsWithAudit).mock.calls[0]?.[0];
    expect(args?.event.input_tokens).toBe(0);
    expect(args?.event.output_tokens).toBe(0);
  });

  it("does NOT throw when deductCreditsWithAudit returns ok:false (fire-and-forget contract)", async () => {
    vi.mocked(computeCreditsDeductedCents).mockResolvedValue(7);
    vi.mocked(deductCreditsWithAudit).mockResolvedValue({
      ok: false,
      error: "credits_usage row not found",
    });

    const message = buildAssistantMessage({
      totalMessageCost: 0.07,
      totalMessageUsage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
    });

    await expect(
      recordChatUsage({
        accountId: ACCOUNT,
        modelId: "anthropic/claude-haiku-4.5",
        responseMessage: message as never,
      }),
    ).resolves.toBeUndefined();
  });

  it("does NOT throw when computeCreditsDeductedCents rejects (fire-and-forget contract)", async () => {
    vi.mocked(computeCreditsDeductedCents).mockRejectedValue(new Error("catalog down"));

    const message = buildAssistantMessage({
      totalMessageCost: 0.07,
      totalMessageUsage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
    });

    await expect(
      recordChatUsage({
        accountId: ACCOUNT,
        modelId: "anthropic/claude-haiku-4.5",
        responseMessage: message as never,
      }),
    ).resolves.toBeUndefined();

    expect(deductCreditsWithAudit).not.toHaveBeenCalled();
  });
});
