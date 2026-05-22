import type { JSONValue, LanguageModel, ModelMessage } from "ai";
import { isAnthropicModel } from "@/lib/agent/contextManagement/isAnthropicModel";

type ProviderOptions = Record<string, Record<string, JSONValue>>;

const DEFAULT_PROVIDER_OPTIONS: ProviderOptions = {
  anthropic: { cacheControl: { type: "ephemeral" } },
};

/**
 * Mark the LAST message with `cacheControl: { type: "ephemeral" }` so
 * Anthropic incrementally caches the conversation prefix. Per
 * Anthropic's docs: "Mark the final block of the final message with
 * cache_control so the conversation can be incrementally cached."
 *
 * Port of open-agents' `addCacheControl({messages, model})` overload
 * in `packages/agent/context-management/cache-control.ts`.
 *
 * For non-Anthropic models the input is returned unchanged. The input
 * array is not mutated — a new array of message refs is returned.
 */
export function addCacheControlToMessages(opts: {
  messages: ModelMessage[];
  model: LanguageModel;
  providerOptions?: ProviderOptions;
}): ModelMessage[] {
  const { messages, model, providerOptions = DEFAULT_PROVIDER_OPTIONS } = opts;

  if (!isAnthropicModel(model)) return messages;
  if (messages.length === 0) return messages;

  const lastIndex = messages.length - 1;
  return messages.map((message, index) =>
    index === lastIndex
      ? {
          ...message,
          providerOptions: {
            ...(message as { providerOptions?: ProviderOptions }).providerOptions,
            ...providerOptions,
          },
        }
      : message,
  );
}
