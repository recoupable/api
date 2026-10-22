import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";

const ADAPTIVE_THINKING_MODELS = new Set([
  "anthropic/claude-opus-4.7",
  "anthropic/claude-opus-4.6",
  "anthropic/claude-sonnet-4.6",
]);

/**
 * Selects thinking options for the explicitly supported Gateway model IDs.
 * Unlisted IDs retain the existing manual configuration, without inferring
 * compatibility for future models or alternate provider naming conventions.
 *
 * @param modelId - The model ID selected for the general agent.
 * @returns Anthropic options accepted by the installed SDK.
 */
export function getAnthropicProviderOptions(modelId: string): AnthropicProviderOptions {
  if (ADAPTIVE_THINKING_MODELS.has(modelId)) {
    return {
      thinking: { type: "adaptive", display: "summarized" },
      effort: "medium",
    };
  }

  return { thinking: { type: "enabled", budgetTokens: 12000 } };
}
