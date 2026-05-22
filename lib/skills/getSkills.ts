import { isAgentContext } from "@/lib/agent/tools/isAgentContext";
import type { SkillMetadata } from "@/lib/skills/skillTypes";

/**
 * Read the discovered skill catalog out of the agent's
 * `experimental_context`. The catalog is populated by the chat handler
 * via `discoverSkills(sandbox, getSandboxSkillDirectories(sandbox))`
 * before workflow start, then threaded through as
 * `AgentContext.skills`. Returns `[]` when the context shape is wrong
 * or no skills were discovered.
 *
 * Lives in its own file so consumers (the `skill` tool today, future
 * skill-aware system prompts tomorrow) share one accessor instead of
 * each reimplementing the context-cast.
 *
 * @param experimental_context - Opaque context object passed by AI SDK to tool execute.
 */
export function getSkills(experimental_context: unknown): SkillMetadata[] {
  if (!isAgentContext(experimental_context)) return [];
  const ctx = experimental_context as { skills?: SkillMetadata[] };
  return ctx.skills ?? [];
}
