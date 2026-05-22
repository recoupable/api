import { describe, it, expect } from "vitest";
import { isAnthropicModel } from "@/lib/agent/contextManagement/isAnthropicModel";

describe("isAnthropicModel", () => {
  it("returns true for a string model id containing 'anthropic'", () => {
    expect(isAnthropicModel("anthropic/claude-haiku-4.5" as never)).toBe(true);
  });

  it("returns true for a string model id containing 'claude' (no provider prefix)", () => {
    expect(isAnthropicModel("claude-3-5-haiku" as never)).toBe(true);
  });

  it("returns false for non-Anthropic string model ids", () => {
    expect(isAnthropicModel("openai/gpt-5.2" as never)).toBe(false);
    expect(isAnthropicModel("google/gemini-3" as never)).toBe(false);
  });

  it("returns true for a model object whose `provider` is 'anthropic'", () => {
    expect(isAnthropicModel({ provider: "anthropic", modelId: "claude-haiku-4.5" } as never)).toBe(
      true,
    );
  });

  it("returns true for a model object whose `provider` contains 'anthropic' (gateway-prefixed)", () => {
    expect(isAnthropicModel({ provider: "gateway.anthropic", modelId: "x" } as never)).toBe(true);
  });

  it("returns true for a model object whose `modelId` contains 'anthropic' or 'claude'", () => {
    expect(isAnthropicModel({ provider: "gateway", modelId: "anthropic/x" } as never)).toBe(true);
    expect(isAnthropicModel({ provider: "gateway", modelId: "claude-x" } as never)).toBe(true);
  });

  it("returns false for a model object with no anthropic / claude markers", () => {
    expect(isAnthropicModel({ provider: "openai", modelId: "gpt-5" } as never)).toBe(false);
  });
});
