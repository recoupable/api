import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the toolChains module
vi.mock("../toolChains", () => ({
  TOOL_CHAINS: {
    test_trigger: [
      { toolName: "step_one" },
      { toolName: "step_two" },
      { toolName: "step_three" },
    ],
    custom_chain: [
      {
        toolName: "custom_step_one",
        system: "Custom system prompt for step one",
      },
      {
        toolName: "custom_step_two",
        messages: [{ role: "user", content: "Reference message" }],
      },
    ],
  },
  TOOL_MODEL_MAP: {
    step_two: "gemini-2.5-pro",
    custom_step_one: "gpt-4-turbo",
  },
}));

import getPrepareStepResult from "../getPrepareStepResult";

describe("getPrepareStepResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when no tool chain is triggered", () => {
    it("returns undefined when steps is empty", () => {
      const options = {
        steps: [],
        stepNumber: 0,
        model: "test-model",
        messages: [],
      };

      const result = getPrepareStepResult(options as any);
      expect(result).toBeUndefined();
    });

    it("returns undefined when no trigger tool has been executed", () => {
      const options = {
        steps: [
          {
            toolResults: [
              { toolCallId: "call-1", toolName: "unrelated_tool", output: { type: "json", value: {} } },
            ],
          },
        ],
        stepNumber: 1,
        model: "test-model",
        messages: [],
      };

      const result = getPrepareStepResult(options as any);
      expect(result).toBeUndefined();
    });
  });

  describe("tool chain progression", () => {
    it("returns the first tool in sequence when trigger tool is executed", () => {
      const options = {
        steps: [
          {
            toolResults: [
              { toolCallId: "call-1", toolName: "test_trigger", output: { type: "json", value: {} } },
            ],
          },
        ],
        stepNumber: 1,
        model: "test-model",
        messages: [],
      };

      const result = getPrepareStepResult(options as any);
      expect(result).toEqual({
        toolChoice: { type: "tool", toolName: "step_one" },
      });
    });

    it("returns the second tool after first tool in sequence is executed", () => {
      const options = {
        steps: [
          {
            toolResults: [
              { toolCallId: "call-1", toolName: "test_trigger", output: { type: "json", value: {} } },
            ],
          },
          {
            toolResults: [
              { toolCallId: "call-2", toolName: "step_one", output: { type: "json", value: {} } },
            ],
          },
        ],
        stepNumber: 2,
        model: "test-model",
        messages: [],
      };

      const result = getPrepareStepResult(options as any);
      expect(result).toEqual({
        toolChoice: { type: "tool", toolName: "step_two" },
        model: "gemini-2.5-pro", // From TOOL_MODEL_MAP
      });
    });

    it("returns undefined when all tools in sequence have been executed", () => {
      const options = {
        steps: [
          {
            toolResults: [
              { toolCallId: "call-1", toolName: "test_trigger", output: { type: "json", value: {} } },
            ],
          },
          {
            toolResults: [
              { toolCallId: "call-2", toolName: "step_one", output: { type: "json", value: {} } },
            ],
          },
          {
            toolResults: [
              { toolCallId: "call-3", toolName: "step_two", output: { type: "json", value: {} } },
            ],
          },
          {
            toolResults: [
              { toolCallId: "call-4", toolName: "step_three", output: { type: "json", value: {} } },
            ],
          },
        ],
        stepNumber: 4,
        model: "test-model",
        messages: [],
      };

      const result = getPrepareStepResult(options as any);
      expect(result).toBeUndefined();
    });

    it("handles out-of-order tool executions by matching timeline against sequence", () => {
      const options = {
        steps: [
          {
            toolResults: [
              { toolCallId: "call-1", toolName: "test_trigger", output: { type: "json", value: {} } },
            ],
          },
          {
            toolResults: [
              { toolCallId: "call-2", toolName: "some_other_tool", output: { type: "json", value: {} } },
            ],
          },
          {
            toolResults: [
              { toolCallId: "call-3", toolName: "step_one", output: { type: "json", value: {} } },
            ],
          },
        ],
        stepNumber: 3,
        model: "test-model",
        messages: [],
      };

      const result = getPrepareStepResult(options as any);
      // Should return step_two since step_one has been executed
      expect(result).toEqual({
        toolChoice: { type: "tool", toolName: "step_two" },
        model: "gemini-2.5-pro",
      });
    });
  });

  describe("custom chain with system prompts and messages", () => {
    it("includes system prompt when defined in tool chain item", () => {
      const options = {
        steps: [
          {
            toolResults: [
              { toolCallId: "call-1", toolName: "custom_chain", output: { type: "json", value: {} } },
            ],
          },
        ],
        stepNumber: 1,
        model: "test-model",
        messages: [],
      };

      const result = getPrepareStepResult(options as any);
      expect(result).toEqual({
        toolChoice: { type: "tool", toolName: "custom_step_one" },
        system: "Custom system prompt for step one",
        model: "gpt-4-turbo",
      });
    });

    it("includes messages when defined in tool chain item", () => {
      const existingMessages = [{ role: "user", content: "Hello" }];
      const options = {
        steps: [
          {
            toolResults: [
              { toolCallId: "call-1", toolName: "custom_chain", output: { type: "json", value: {} } },
            ],
          },
          {
            toolResults: [
              { toolCallId: "call-2", toolName: "custom_step_one", output: { type: "json", value: {} } },
            ],
          },
        ],
        stepNumber: 2,
        model: "test-model",
        messages: existingMessages,
      };

      const result = getPrepareStepResult(options as any);
      expect(result).toEqual({
        toolChoice: { type: "tool", toolName: "custom_step_two" },
        messages: [
          { role: "user", content: "Hello" },
          { role: "user", content: "Reference message" },
        ],
      });
    });
  });

  describe("model override from TOOL_MODEL_MAP", () => {
    it("includes model override when tool is in TOOL_MODEL_MAP", () => {
      const options = {
        steps: [
          {
            toolResults: [
              { toolCallId: "call-1", toolName: "test_trigger", output: { type: "json", value: {} } },
            ],
          },
          {
            toolResults: [
              { toolCallId: "call-2", toolName: "step_one", output: { type: "json", value: {} } },
            ],
          },
        ],
        stepNumber: 2,
        model: "test-model",
        messages: [],
      };

      const result = getPrepareStepResult(options as any);
      expect(result?.model).toBe("gemini-2.5-pro");
    });

    it("does not include model when tool is not in TOOL_MODEL_MAP", () => {
      const options = {
        steps: [
          {
            toolResults: [
              { toolCallId: "call-1", toolName: "test_trigger", output: { type: "json", value: {} } },
            ],
          },
        ],
        stepNumber: 1,
        model: "test-model",
        messages: [],
      };

      const result = getPrepareStepResult(options as any);
      expect(result?.model).toBeUndefined();
    });
  });
});
