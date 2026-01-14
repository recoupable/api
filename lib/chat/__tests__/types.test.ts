import { describe, it, expect } from "vitest";
import { stepCountIs, ToolLoopAgent } from "ai";
import type { ChatConfig, RoutingDecision } from "../types";

describe("Chat Types", () => {
  describe("RoutingDecision", () => {
    it("should have required model property", () => {
      const decision: RoutingDecision = {
        model: "gpt-4",
        instructions: "Test instructions",
        agent: new ToolLoopAgent({ model: "gpt-4" }),
      };
      expect(decision.model).toBe("gpt-4");
    });

    it("should have required instructions property", () => {
      const decision: RoutingDecision = {
        model: "gpt-4",
        instructions: "Test instructions",
        agent: new ToolLoopAgent({ model: "gpt-4" }),
      };
      expect(decision.instructions).toBe("Test instructions");
    });

    it("should have optional stopWhen property", () => {
      const decision: RoutingDecision = {
        model: "gpt-4",
        instructions: "Test instructions",
        agent: new ToolLoopAgent({ model: "gpt-4" }),
        stopWhen: stepCountIs(5),
      };
      expect(decision.stopWhen).toBeDefined();
    });
  });

  describe("ChatConfig", () => {
    it("should extend RoutingDecision", () => {
      const agent = new ToolLoopAgent({ model: "gpt-4" });
      const config: ChatConfig = {
        model: "gpt-4",
        instructions: "Test instructions",
        agent,
        system: "You are a helpful assistant",
        messages: [],
        experimental_generateMessageId: () => "test-id",
        tools: {},
      };
      expect(config.model).toBe("gpt-4");
      expect(config.system).toBe("You are a helpful assistant");
    });

    it("should have required system property", () => {
      const agent = new ToolLoopAgent({ model: "gpt-4" });
      const config: ChatConfig = {
        model: "gpt-4",
        instructions: "Test instructions",
        agent,
        system: "System prompt",
        messages: [],
        experimental_generateMessageId: () => "test-id",
        tools: {},
      };
      expect(config.system).toBe("System prompt");
    });

    it("should have required messages array", () => {
      const agent = new ToolLoopAgent({ model: "gpt-4" });
      const config: ChatConfig = {
        model: "gpt-4",
        instructions: "Test instructions",
        agent,
        system: "System prompt",
        messages: [{ role: "user", content: "Hello" }],
        experimental_generateMessageId: () => "test-id",
        tools: {},
      };
      expect(config.messages).toHaveLength(1);
    });

    it("should have required experimental_generateMessageId function", () => {
      const agent = new ToolLoopAgent({ model: "gpt-4" });
      const config: ChatConfig = {
        model: "gpt-4",
        instructions: "Test instructions",
        agent,
        system: "System prompt",
        messages: [],
        experimental_generateMessageId: () => "generated-id-123",
        tools: {},
      };
      expect(config.experimental_generateMessageId()).toBe("generated-id-123");
    });

    it("should have optional experimental_download function", () => {
      const agent = new ToolLoopAgent({ model: "gpt-4" });
      const config: ChatConfig = {
        model: "gpt-4",
        instructions: "Test instructions",
        agent,
        system: "System prompt",
        messages: [],
        experimental_generateMessageId: () => "test-id",
        tools: {},
        experimental_download: async () => [],
      };
      expect(config.experimental_download).toBeDefined();
    });

    it("should have optional prepareStep function", () => {
      const agent = new ToolLoopAgent({ model: "gpt-4" });
      const config: ChatConfig = {
        model: "gpt-4",
        instructions: "Test instructions",
        agent,
        system: "System prompt",
        messages: [],
        experimental_generateMessageId: () => "test-id",
        tools: {},
        prepareStep: (options) => options,
      };
      expect(config.prepareStep).toBeDefined();
    });

    it("should have optional providerOptions property", () => {
      const agent = new ToolLoopAgent({ model: "gpt-4" });
      const config: ChatConfig = {
        model: "gpt-4",
        instructions: "Test instructions",
        agent,
        system: "System prompt",
        messages: [],
        experimental_generateMessageId: () => "test-id",
        tools: {},
        providerOptions: {
          anthropic: { thinking: { type: "enabled", budgetTokens: 12000 } },
        },
      };
      expect(config.providerOptions).toBeDefined();
      expect(config.providerOptions?.anthropic).toBeDefined();
    });
  });
});
