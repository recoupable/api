import type { ToolSet } from "ai";
import type { AgentContext } from "@/lib/agent/tools/AgentContext";

/**
 * Build the AI SDK v7 `toolsContext` map.
 *
 * v7 split the old single `experimental_context` into shared `runtimeContext`
 * and a per-tool-name `toolsContext` map (see the AI SDK 7.0 migration guide:
 * "Context: experimental_context Became Tool context"). Every Recoup agent
 * tool reads the same `AgentContext` (sandbox handle, org id, skills, model),
 * so we fan the single context out to one entry per tool in the set.
 *
 * Returning a `Record<string, AgentContext>` (index signature) keeps this DRY
 * across tool sets and stays assignable to the SDK's concrete
 * `InferToolSetContext<TOOLS>` shape, since every typed tool's required entry
 * is satisfied with an `AgentContext` value.
 */
export function buildToolsContext(
  tools: ToolSet,
  context: AgentContext,
): Record<string, AgentContext> {
  return Object.fromEntries(Object.keys(tools).map(name => [name, context]));
}
