import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleSubagentChatCredits } from "../handleSubagentChatCredits";
import { handleChatCredits } from "../handleChatCredits";

vi.mock("../handleChatCredits", () => ({
  handleChatCredits: vi.fn(),
}));

const taskPart = {
  type: "tool-task",
  toolCallId: "tc-sub",
  state: "output-available",
  input: {},
  output: {
    usage: { inputTokens: 20, outputTokens: 8, cachedInputTokens: 0 },
    modelId: "anthropic/claude-sonnet-4.6",
  },
};

describe("handleSubagentChatCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records one subagent usage row per model for new task tool output", async () => {
    await handleSubagentChatCredits({
      accountId: "acc-1",
      fallbackModelId: "anthropic/claude-haiku-4.5",
      responseMessage: {
        id: "m1",
        role: "assistant",
        parts: [taskPart],
      } as never,
    });

    expect(handleChatCredits).toHaveBeenCalledTimes(1);
    expect(handleChatCredits).toHaveBeenCalledWith({
      accountId: "acc-1",
      model: "anthropic/claude-sonnet-4.6",
      source: "api",
      agentType: "subagent",
      usage: { inputTokens: 20, outputTokens: 8, cachedInputTokens: 0 },
      toolCallCount: 1,
    });
  });

  it("does not bill task tools already present on the baseline assistant message", async () => {
    const previous = {
      id: "m-prev",
      role: "assistant",
      parts: [taskPart],
    };

    await handleSubagentChatCredits({
      accountId: "acc-1",
      fallbackModelId: "anthropic/claude-haiku-4.5",
      previousResponseMessage: previous as never,
      responseMessage: {
        id: "m-prev",
        role: "assistant",
        parts: [taskPart],
      } as never,
    });

    expect(handleChatCredits).not.toHaveBeenCalled();
  });
});
