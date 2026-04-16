import { AnthropicProviderOptions } from "@ai-sdk/anthropic";

/**
 * Models that require or prefer Anthropic's adaptive thinking mode.
 *
 * - Opus 4.7: adaptive is the ONLY supported mode; manual `type: "enabled"` is rejected.
 * - Opus 4.6 / Sonnet 4.6: adaptive is preferred; manual `type: "enabled"` is deprecated.
 *
 * All older Anthropic models (Sonnet 4.5, Opus 4.5, Haiku 3.x, etc.) do NOT support
 * adaptive and must continue using `type: "enabled"` with `budgetTokens`.
 *
 * Reference: https://docs.claude.com/en/docs/build-with-claude/adaptive-thinking
 */
const ADAPTIVE_THINKING_MODELS = new Set<string>([
  "anthropic/claude-opus-4.7",
  "anthropic/claude-opus-4.6",
  "anthropic/claude-sonnet-4.6",
]);

/**
 * Returns Anthropic provider options shaped correctly for the given model.
 *
 * The shape differs between modern (4.6+) and legacy Anthropic models because
 * Anthropic changed its thinking API. See `ADAPTIVE_THINKING_MODELS` above.
 *
 * @param modelId - Full model ID from the AI Gateway (e.g., "anthropic/claude-opus-4.7")
 * @returns Provider options valid for the given model. Unknown or non-Anthropic
 *   model IDs fall back to the legacy shape, which is a safe default.
 */
export function getAnthropicProviderOptions(modelId: string): AnthropicProviderOptions {
  if (ADAPTIVE_THINKING_MODELS.has(modelId)) {
    return {
      thinking: { type: "adaptive", display: "summarized" },
      effort: "medium",
    };
  }
  return {
    thinking: { type: "enabled", budgetTokens: 12000 },
  };
}
