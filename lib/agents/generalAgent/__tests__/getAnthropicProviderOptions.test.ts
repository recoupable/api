import { createAnthropic } from "@ai-sdk/anthropic";
import { describe, expect, it, vi } from "vitest";
import { getAnthropicProviderOptions } from "../getAnthropicProviderOptions";

describe("Anthropic thinking request compatibility", () => {
  it.each([
    ["anthropic/claude-opus-4.7", "adaptive"],
    ["anthropic/claude-opus-4.6", "adaptive"],
    ["anthropic/claude-sonnet-4.6", "adaptive"],
    ["anthropic/claude-sonnet-4.5", "enabled"],
    ["anthropic/claude-opus-4.5", "enabled"],
    ["anthropic/claude-haiku-4.5", "enabled"],
  ])("serializes %s through the installed SDK", async (model, mode) => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "fixture-message",
          type: "message",
          role: "assistant",
          model: model.replace("anthropic/", ""),
          content: [{ type: "text", text: "fixture response" }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
    const provider = createAnthropic({ apiKey: "fixture-only", fetch });
    await provider(model.replace("anthropic/", "")).doGenerate({
      prompt: [{ role: "user", content: [{ type: "text", text: "fixture" }] }],
      providerOptions: { anthropic: getAnthropicProviderOptions(model) },
    });

    expect(fetch).toHaveBeenCalledOnce();
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.thinking).toEqual(
      mode === "adaptive"
        ? { type: "adaptive", display: "summarized" }
        : { type: "enabled", budget_tokens: 12000 },
    );
    if (mode === "adaptive") {
      expect(body.output_config.effort).toBe("medium");
    } else {
      expect(body.output_config).toBeUndefined();
    }
  });

  it.each(["openai/gpt-5-mini", "anthropic/unknown-model", "claude-opus-4.7"])(
    "preserves the existing configuration for unlisted ID %s",
    model => {
      expect(getAnthropicProviderOptions(model)).toEqual({
        thinking: { type: "enabled", budgetTokens: 12000 },
      });
    },
  );
});
