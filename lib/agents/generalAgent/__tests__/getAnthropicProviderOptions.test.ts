import { describe, it, expect } from "vitest";
import { getAnthropicProviderOptions } from "../getAnthropicProviderOptions";

describe("getAnthropicProviderOptions", () => {
  describe("models that require/prefer adaptive thinking", () => {
    it("returns adaptive thinking config for Opus 4.7", () => {
      const result = getAnthropicProviderOptions("anthropic/claude-opus-4.7");
      expect(result).toEqual({
        thinking: { type: "adaptive", display: "summarized" },
        effort: "medium",
      });
    });

    it("returns adaptive thinking config for Opus 4.6", () => {
      const result = getAnthropicProviderOptions("anthropic/claude-opus-4.6");
      expect(result).toEqual({
        thinking: { type: "adaptive", display: "summarized" },
        effort: "medium",
      });
    });

    it("returns adaptive thinking config for Sonnet 4.6", () => {
      const result = getAnthropicProviderOptions("anthropic/claude-sonnet-4.6");
      expect(result).toEqual({
        thinking: { type: "adaptive", display: "summarized" },
        effort: "medium",
      });
    });

    it("omits budgetTokens on the adaptive branch", () => {
      const result = getAnthropicProviderOptions("anthropic/claude-opus-4.7");
      expect(result.thinking).not.toHaveProperty("budgetTokens");
    });
  });

  describe("legacy Anthropic models that only support manual thinking", () => {
    it("returns enabled thinking config with budgetTokens for Sonnet 4.5", () => {
      const result = getAnthropicProviderOptions("anthropic/claude-sonnet-4.5");
      expect(result).toEqual({
        thinking: { type: "enabled", budgetTokens: 12000 },
      });
    });

    it("returns enabled thinking config with budgetTokens for Opus 4.5", () => {
      const result = getAnthropicProviderOptions("anthropic/claude-opus-4.5");
      expect(result).toEqual({
        thinking: { type: "enabled", budgetTokens: 12000 },
      });
    });

    it("omits effort parameter on the manual branch", () => {
      const result = getAnthropicProviderOptions("anthropic/claude-sonnet-4.5");
      expect(result).not.toHaveProperty("effort");
    });
  });

  describe("defensive handling of non-Anthropic and unknown model IDs", () => {
    it("defaults to enabled thinking config for non-Anthropic model IDs", () => {
      // Even though this config won't be applied to non-Anthropic models
      // (providerOptions.anthropic is ignored for e.g. OpenAI), the function
      // must still return a valid AnthropicProviderOptions shape.
      const result = getAnthropicProviderOptions("openai/gpt-5-mini");
      expect(result).toEqual({
        thinking: { type: "enabled", budgetTokens: 12000 },
      });
    });

    it("defaults to enabled thinking config for unknown/new Anthropic models", () => {
      // A future model not yet in our allowlist falls back to the legacy config.
      // This is the safe default because every Anthropic model predating 4.6
      // required this shape; the allowlist is explicit for 4.6+ models.
      const result = getAnthropicProviderOptions("anthropic/claude-haiku-3.5");
      expect(result).toEqual({
        thinking: { type: "enabled", budgetTokens: 12000 },
      });
    });
  });
});
