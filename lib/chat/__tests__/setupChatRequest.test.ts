import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatRequestBody } from "../validateChatRequest";

import { setupChatRequest } from "../setupChatRequest";
import getGeneralAgent from "@/lib/agents/generalAgent/getGeneralAgent";
import { convertToModelMessages } from "ai";

// Mock dependencies
vi.mock("@/lib/agents/generalAgent/getGeneralAgent", () => ({
  default: vi.fn(),
}));

vi.mock("ai", async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    convertToModelMessages: vi.fn(messages => messages),
    stepCountIs: actual.stepCountIs,
    ToolLoopAgent: actual.ToolLoopAgent,
  };
});

const mockGetGeneralAgent = vi.mocked(getGeneralAgent);
const mockConvertToModelMessages = vi.mocked(convertToModelMessages);

describe("setupChatRequest", () => {
  const mockAgent = {
    model: "claude-sonnet-4-20250514",
    tools: {},
    instructions: "You are a helpful assistant",
    stopWhen: undefined,
  };

  const mockRoutingDecision = {
    model: "claude-sonnet-4-20250514",
    instructions: "You are a helpful assistant",
    agent: mockAgent,
    stopWhen: undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGeneralAgent.mockResolvedValue(mockRoutingDecision as any);
    mockConvertToModelMessages.mockImplementation(messages => messages as any);
  });

  describe("basic functionality", () => {
    it("returns a ChatConfig with only agent and messages", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await setupChatRequest(body);

      expect(result).toHaveProperty("agent");
      expect(result).toHaveProperty("messages");
      expect(Object.keys(result)).toEqual(["agent", "messages"]);
    });

    it("does not include system, tools, model, instructions, or experimental fields", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await setupChatRequest(body);

      expect(result).not.toHaveProperty("system");
      expect(result).not.toHaveProperty("tools");
      expect(result).not.toHaveProperty("model");
      expect(result).not.toHaveProperty("instructions");
      expect(result).not.toHaveProperty("experimental_generateMessageId");
      expect(result).not.toHaveProperty("providerOptions");
      expect(result).not.toHaveProperty("prepareStep");
    });

    it("calls getGeneralAgent with the body", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      await setupChatRequest(body);

      expect(mockGetGeneralAgent).toHaveBeenCalledWith(body);
    });

    it("returns the agent from the routing decision", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await setupChatRequest(body);

      expect(result.agent).toBe(mockAgent);
    });
  });

  describe("message conversion", () => {
    it("converts messages using convertToModelMessages", async () => {
      const messages = [
        { id: "1", role: "user", content: "Hello" },
        { id: "2", role: "assistant", content: "Hi there!" },
      ];
      const body: ChatRequestBody = {
        accountId: "account-123",
        messages,
      };

      await setupChatRequest(body);

      expect(mockConvertToModelMessages).toHaveBeenCalledWith(messages, expect.any(Object));
    });

    it("passes agent tools to convertToModelMessages", async () => {
      const mockTools = { tool1: {}, tool2: {} };
      mockGetGeneralAgent.mockResolvedValue({
        ...mockRoutingDecision,
        agent: {
          ...mockAgent,
          tools: mockTools,
        },
      } as any);

      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      await setupChatRequest(body);

      expect(mockConvertToModelMessages).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          tools: mockTools,
          ignoreIncompleteToolCalls: true,
        }),
      );
    });

    it("limits messages to MAX_MESSAGES", async () => {
      const manyMessages = Array.from({ length: 100 }, (_, i) => ({
        id: `${i}`,
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Message ${i}`,
      }));

      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        messages: manyMessages,
      };

      const result = await setupChatRequest(body);

      // Should be limited to MAX_MESSAGES (55)
      expect(result.messages.length).toBeLessThanOrEqual(55);
    });
  });
});
