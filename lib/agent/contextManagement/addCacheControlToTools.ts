import type { JSONValue, LanguageModel, ToolSet } from "ai";
import { isAnthropicModel } from "@/lib/agent/contextManagement/isAnthropicModel";

type ProviderOptions = Record<string, Record<string, JSONValue>>;

const DEFAULT_PROVIDER_OPTIONS: ProviderOptions = {
  anthropic: { cacheControl: { type: "ephemeral" } },
};

/**
 * Mark the LAST tool in a toolset with `cacheControl: { type: "ephemeral" }`
 * so Anthropic caches the tool-definitions block across the conversation.
 *
 * Port of open-agents' `addCacheControl({tools, model})` overload in
 * `packages/agent/context-management/cache-control.ts`. Why only the
 * last tool: Anthropic enforces a max of 4 cache breakpoints, and we
 * spend one each on the system prompt + messages, so we conserve by
 * marking just the trailing tool entry (the message's cumulative
 * cache covers the rest).
 *
 * For non-Anthropic models the input is returned unchanged.
 */
export function addCacheControlToTools<T extends ToolSet>(opts: {
  tools: T;
  model: LanguageModel;
  providerOptions?: ProviderOptions;
}): T {
  const { tools, model, providerOptions = DEFAULT_PROVIDER_OPTIONS } = opts;

  if (!isAnthropicModel(model)) return tools;

  const entries = Object.entries(tools);
  if (entries.length === 0) return tools;

  const lastIndex = entries.length - 1;
  return Object.fromEntries(
    entries.map(([name, t], index) => [
      name,
      index === lastIndex
        ? {
            ...t,
            providerOptions: {
              ...(t as { providerOptions?: ProviderOptions }).providerOptions,
              ...providerOptions,
            },
          }
        : t,
    ]),
  ) as T;
}
