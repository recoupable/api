import { bashTool } from "@/lib/agent/tools/bashTool";
import { readFileTool } from "@/lib/agent/tools/readFileTool";
import { writeFileTool } from "@/lib/agent/tools/writeFileTool";
import { editFileTool } from "@/lib/agent/tools/editFileTool";
import { grepTool } from "@/lib/agent/tools/grepTool";
import { globTool } from "@/lib/agent/tools/globTool";
import { todoWriteTool } from "@/lib/agent/tools/todoWriteTool";
import { webFetchTool } from "@/lib/agent/tools/webFetchTool";
import { skillTool } from "@/lib/agent/tools/skillTool";
import type { SkillMetadata } from "@/lib/skills/skillTypes";

/**
 * Factory for the full agent tool set passed into `streamText({ tools })`.
 * Each tool reads its sandbox handle + per-prompt context from
 * `experimental_context` at execute time — the factory is otherwise stateless.
 *
 * Currently ships 9 tools:
 *   - 6 file/shell: bash, read, write, edit, grep, glob
 *   - todo_write (planning surface; stateless, echoes the list back)
 *   - web_fetch (HTTP via curl inside the sandbox)
 *   - skill (load a project-level skill's SKILL.md; only registered when the
 *     sandbox has skills available, so models without any skill catalog
 *     don't see the tool at all and never call it speculatively)
 *
 * @param options.skills - Discovered skill catalog. When empty / undefined,
 *   `skill` is omitted from the tool record so the model doesn't see it.
 */
export function buildAgentTools(options: { skills?: SkillMetadata[] } = {}) {
  const hasSkills = (options.skills?.length ?? 0) > 0;
  return {
    bash: bashTool,
    read: readFileTool,
    write: writeFileTool,
    edit: editFileTool,
    grep: grepTool,
    glob: globTool,
    todo_write: todoWriteTool,
    web_fetch: webFetchTool,
    ...(hasSkills ? { skill: skillTool } : {}),
  };
}

export type AgentTools = ReturnType<typeof buildAgentTools>;
