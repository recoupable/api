import type { LanguageModel } from "ai";
import { isAgentContext } from "@/lib/agent/tools/isAgentContext";

/**
 * Resolve the subagent's language model from `experimental_context`,
 * falling back to the main agent's model when no dedicated subagent
 * model is configured. Mirrors open-agents' `getSubagentModel`
 * (`tools/utils.ts`): `ctx.subagentModel ?? ctx.model`.
 *
 * @param experimental_context - Opaque context object the AI SDK threads
 *   into tool execute callbacks.
 * @param toolName - Optional tool name for richer error messages.
 */
export function getSubagentModel(experimental_context: unknown, toolName?: string): LanguageModel {
  const context = isAgentContext(experimental_context) ? experimental_context : undefined;
  if (!context?.model) {
    const toolInfo = toolName ? ` (tool: ${toolName})` : "";
    throw new Error(
      `Model not initialized in context${toolInfo}. ` +
        "Ensure runAgentStep sets experimental_context: { model, ... }",
    );
  }
  return context.subagentModel ?? context.model;
}
