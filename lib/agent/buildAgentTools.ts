import { askUserQuestionTool } from "@/lib/agent/tools/askUserQuestionTool";
import { bashTool } from "@/lib/agent/tools/bashTool";
import { readFileTool } from "@/lib/agent/tools/readFileTool";
import { writeFileTool } from "@/lib/agent/tools/writeFileTool";
import { editFileTool } from "@/lib/agent/tools/editFileTool";
import { grepTool } from "@/lib/agent/tools/grepTool";
import { globTool } from "@/lib/agent/tools/globTool";
import { todoWriteTool } from "@/lib/agent/tools/todoWriteTool";
import { webFetchTool } from "@/lib/agent/tools/webFetchTool";
import { skillTool } from "@/lib/agent/tools/skillTool";
import { taskTool } from "@/lib/agent/tools/taskTool";
import type { SkillMetadata } from "@/lib/skills/skillTypes";

/**
 * Factory for the full agent tool set passed into `streamText({ tools })`.
 * Each tool reads its sandbox handle + per-prompt context from
 * `experimental_context` at execute time — the factory is otherwise stateless.
 *
 * Currently ships 11 tools:
 *
 * Sandbox / file ops (6):
 *   - bash, read, write, edit, grep, glob
 *
 * Composite (2):
 *   - task — delegate focused work to a subagent (sub-streamText loop;
 *     subagent has only read/write/edit/grep/glob/bash to prevent
 *     recursion via task itself, matching open-agents' subagent
 *     curation)
 *   - skill — load a project-level skill's SKILL.md (only registered
 *     when the sandbox has skills available)
 *
 * Client-side / planning (3):
 *   - todo_write (stateless planning surface)
 *   - web_fetch (HTTP via curl inside the sandbox)
 *   - ask_user_question (no server execute; chat UI fulfills it and
 *     the next workflow turn sees the answer in messages)
 *
 * @param options.skills - Discovered skill catalog. When empty / undefined,
 *   `skill` is omitted from the tool record so the model doesn't see it.
 */
export function buildAgentTools(options: { skills?: SkillMetadata[]; interactive?: boolean } = {}) {
  const hasSkills = (options.skills?.length ?? 0) > 0;
  // ask_user_question has no server execute — only a streaming chat UI can
  // fulfill it. In headless/async runs (customer-prompt-task, /api/chat/runs)
  // there is no user to answer, so it's a dead-end; omit it there and force the
  // agent to act (send an honest result or stop) rather than hang on a question.
  const interactive = options.interactive ?? true;
  return {
    bash: bashTool,
    read: readFileTool,
    write: writeFileTool,
    edit: editFileTool,
    grep: grepTool,
    glob: globTool,
    todo_write: todoWriteTool,
    web_fetch: webFetchTool,
    task: taskTool,
    ...(interactive ? { ask_user_question: askUserQuestionTool } : {}),
    ...(hasSkills ? { skill: skillTool } : {}),
  };
}

export type AgentTools = ReturnType<typeof buildAgentTools>;
