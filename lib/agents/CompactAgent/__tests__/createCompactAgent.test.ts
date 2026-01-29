import { describe, it, expect, vi } from "vitest";
import { createCompactAgent } from "../createCompactAgent";

vi.mock("ai", () => ({
  ToolLoopAgent: vi.fn().mockImplementation(config => ({
    config,
    generate: vi.fn(),
  })),
  stepCountIs: vi.fn().mockReturnValue("stepCountMock"),
}));

vi.mock("@/lib/const", () => ({
  LIGHTWEIGHT_MODEL: "test-lightweight-model",
}));

describe("createCompactAgent", () => {
  it("creates an agent with default instructions", () => {
    const agent = createCompactAgent();

    expect(agent.config).toEqual({
      model: "test-lightweight-model",
      instructions: expect.stringContaining("conversation summarizer"),
      stopWhen: "stepCountMock",
    });
  });

  it("creates an agent with custom instructions", () => {
    const customInstructions = "Focus only on action items and decisions";
    const agent = createCompactAgent(customInstructions);

    expect(agent.config).toEqual({
      model: "test-lightweight-model",
      instructions: customInstructions,
      stopWhen: "stepCountMock",
    });
  });

  it("uses lightweight model for cost efficiency", () => {
    const agent = createCompactAgent();

    expect(agent.config.model).toBe("test-lightweight-model");
  });
});
