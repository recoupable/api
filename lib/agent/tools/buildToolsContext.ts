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
 * Preserve the tool-name keys so strict callers can prove every required
 * contextual tool has an entry. Object.fromEntries erases those keys; the
 * assertion restores exactly the keys enumerated from the input tool set.
 */
export function buildToolsContext<TOOLS extends ToolSet>(
  tools: TOOLS,
  context: AgentContext,
): { [K in keyof TOOLS]: AgentContext } {
  return Object.fromEntries(Object.keys(tools).map(name => [name, context])) as {
    [K in keyof TOOLS]: AgentContext;
  };
}
