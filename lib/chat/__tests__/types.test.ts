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
    it("should have required agent property", () => {
      const agent = new ToolLoopAgent({ model: "gpt-4" });
      const config: ChatConfig = {
        agent,
        messages: [],
      };
      expect(config.agent).toBe(agent);
    });

    it("should have required messages array", () => {
      const agent = new ToolLoopAgent({ model: "gpt-4" });
      const config: ChatConfig = {
        agent,
        messages: [{ role: "user", content: "Hello" }],
      };
      expect(config.messages).toHaveLength(1);
    });

    it("should only contain agent and messages (YAGNI)", () => {
      const agent = new ToolLoopAgent({ model: "gpt-4" });
      const config: ChatConfig = {
        agent,
        messages: [],
      };
      expect(Object.keys(config)).toEqual(["agent", "messages"]);
    });
  });
});
