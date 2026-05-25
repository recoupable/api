import type { LanguageModel } from "ai";

/**
 * Predicate: is this a Claude / Anthropic model? Drives whether to
 * attach `cacheControl: { type: "ephemeral" }` to messages + tools
 * (Anthropic prompt caching) or leave them untouched.
 *
 * Byte-for-byte port of open-agents' `isAnthropicModel`
 * (`packages/agent/context-management/cache-control.ts`).
 *
 * Accepts both string model ids (e.g. `"anthropic/claude-haiku-4.5"`)
 * and `LanguageModel` instances (e.g. the value returned from
 * `gateway("anthropic/claude-...")`, which carries `provider` and
 * `modelId` properties).
 */
export function isAnthropicModel(model: LanguageModel): boolean {
  if (typeof model === "string") {
    return model.includes("anthropic") || model.includes("claude");
  }
  return (
    model.provider === "anthropic" ||
    model.provider.includes("anthropic") ||
    model.modelId.includes("anthropic") ||
    model.modelId.includes("claude")
  );
}
