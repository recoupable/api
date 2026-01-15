import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatRequestBody } from "../validateChatRequest";

// Mock dependencies
vi.mock("@/lib/agents/generalAgent/getGeneralAgent", () => ({
  default: vi.fn(),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    convertToModelMessages: vi.fn((messages) => messages),
    stepCountIs: actual.stepCountIs,
    ToolLoopAgent: actual.ToolLoopAgent,
  };
});

import { setupChatRequest } from "../setupChatRequest";
import getGeneralAgent from "@/lib/agents/generalAgent/getGeneralAgent";
import { convertToModelMessages } from "ai";

const mockGetGeneralAgent = vi.mocked(getGeneralAgent);
const mockConvertToModelMessages = vi.mocked(convertToModelMessages);

describe("setupChatRequest", () => {
  const mockRoutingDecision = {
    model: "claude-sonnet-4-20250514",
    instructions: "You are a helpful assistant",
    agent: {
      model: "claude-sonnet-4-20250514",
      tools: {},
      instructions: "You are a helpful assistant",
      stopWhen: undefined,
    },
    stopWhen: undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGeneralAgent.mockResolvedValue(mockRoutingDecision as any);
    mockConvertToModelMessages.mockImplementation((messages) => messages as any);
  });

  describe("basic functionality", () => {
    it("returns a ChatConfig object with all required properties", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await setupChatRequest(body);

      expect(result).toHaveProperty("system");
      expect(result).toHaveProperty("messages");
      expect(result).toHaveProperty("experimental_generateMessageId");
      expect(result).toHaveProperty("tools");
      expect(result).toHaveProperty("providerOptions");
    });

    it("calls getGeneralAgent with the body", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      await setupChatRequest(body);

      expect(mockGetGeneralAgent).toHaveBeenCalledWith(body);
    });

    it("uses instructions from routing decision as system prompt", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await setupChatRequest(body);

      expect(result.system).toBe(mockRoutingDecision.instructions);
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

    it("passes tools to convertToModelMessages", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      await setupChatRequest(body);

      expect(mockConvertToModelMessages).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          tools: expect.any(Object),
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
        messages: manyMessages,
      };

      const result = await setupChatRequest(body);

      // Should be limited to MAX_MESSAGES (55)
      expect(result.messages.length).toBeLessThanOrEqual(55);
    });
  });

  describe("experimental_generateMessageId", () => {
    it("provides a function that generates unique UUIDs", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await setupChatRequest(body);

      const id1 = result.experimental_generateMessageId();
      const id2 = result.experimental_generateMessageId();

      expect(typeof id1).toBe("string");
      expect(typeof id2).toBe("string");
      expect(id1).not.toBe(id2);
      // UUID format validation
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  describe("provider options", () => {
    it("includes anthropic thinking configuration", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await setupChatRequest(body);

      expect(result.providerOptions).toHaveProperty("anthropic");
      expect(result.providerOptions?.anthropic).toHaveProperty("thinking");
    });

    it("includes google thinkingConfig", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await setupChatRequest(body);

      expect(result.providerOptions).toHaveProperty("google");
      expect(result.providerOptions?.google).toHaveProperty("thinkingConfig");
    });

    it("includes openai reasoning configuration", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await setupChatRequest(body);

      expect(result.providerOptions).toHaveProperty("openai");
      expect(result.providerOptions?.openai).toHaveProperty("reasoningEffort");
    });
  });

  describe("routing decision properties", () => {
    it("spreads routing decision properties into result", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await setupChatRequest(body);

      expect(result.model).toBe(mockRoutingDecision.model);
      expect(result.instructions).toBe(mockRoutingDecision.instructions);
      expect(result.agent).toBeDefined();
    });

    it("includes tools from routing decision agent", async () => {
      const mockTools = { tool1: {}, tool2: {} };
      mockGetGeneralAgent.mockResolvedValue({
        ...mockRoutingDecision,
        agent: {
          ...mockRoutingDecision.agent,
          tools: mockTools,
        },
      } as any);

      const body: ChatRequestBody = {
        accountId: "account-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await setupChatRequest(body);

      expect(result.tools).toEqual(mockTools);
    });
  });

  describe("prepareStep function", () => {
    it("includes a prepareStep function", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await setupChatRequest(body);

      expect(result.prepareStep).toBeInstanceOf(Function);
    });

    it("prepareStep returns options when no tool chain matches", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await setupChatRequest(body);

      const mockOptions = { steps: [], stepNumber: 0, model: "test-model", messages: [] };
      const prepareResult = result.prepareStep!(mockOptions as any);

      // Should return the original options when no tool chain matches
      expect(prepareResult).toEqual(mockOptions);
    });

    it("prepareStep returns next tool when tool chain is triggered", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await setupChatRequest(body);

      // Simulate create_new_artist tool being executed
      const mockOptions = {
        steps: [
          {
            toolResults: [
              { toolCallId: "call-1", toolName: "create_new_artist", output: { type: "json", value: {} } },
            ],
          },
        ],
        stepNumber: 1,
        model: "test-model",
        messages: [],
      };
      const prepareResult = result.prepareStep!(mockOptions as any);

      // Should return next tool in the create_new_artist chain (get_spotify_search)
      expect(prepareResult).toHaveProperty("toolChoice");
      expect((prepareResult as any).toolChoice.toolName).toBe("get_spotify_search");
    });

    it("prepareStep merges tool chain result with original options", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await setupChatRequest(body);

      // Simulate create_new_artist tool being executed
      const mockOptions = {
        steps: [
          {
            toolResults: [
              { toolCallId: "call-1", toolName: "create_new_artist", output: { type: "json", value: {} } },
            ],
          },
        ],
        stepNumber: 1,
        model: "original-model",
        messages: [{ role: "user", content: "original" }],
      };
      const prepareResult = result.prepareStep!(mockOptions as any);

      // Should merge original options with tool chain result
      expect(prepareResult).toHaveProperty("stepNumber", 1);
      expect(prepareResult).toHaveProperty("model", "original-model");
      expect(prepareResult).toHaveProperty("toolChoice");
    });
  });
});
