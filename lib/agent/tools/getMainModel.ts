import type { LanguageModel } from "ai";
import { isAgentContext } from "@/lib/agent/tools/isAgentContext";

/**
 * Resolve the main agent's language model from `experimental_context`.
 * Mirrors open-agents' `getMainModel` (`tools/utils.ts`). Throws with a
 * descriptive error if the context wasn't populated by `runAgentStep`.
 *
 * @param experimental_context - Opaque context object the AI SDK threads
 *   into tool execute callbacks.
 * @param toolName - Optional tool name for richer error messages.
 */
export function getMainModel(experimental_context: unknown, toolName?: string): LanguageModel {
  const context = isAgentContext(experimental_context) ? experimental_context : undefined;
  if (!context?.model) {
    const toolInfo = toolName ? ` (tool: ${toolName})` : "";
    const contextInfo = context
      ? `Context exists but model is missing. Context keys: ${Object.keys(context).join(", ")}`
      : "Context is undefined or null";
    throw new Error(
      `Model not initialized in context${toolInfo}. ${contextInfo}. ` +
        "Ensure runAgentStep sets experimental_context: { model, ... }",
    );
  }
  return context.model;
}
