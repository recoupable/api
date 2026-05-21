import { bashTool } from "@/lib/agent/tools/bashTool";
import { readFileTool } from "@/lib/agent/tools/readFileTool";
import { writeFileTool } from "@/lib/agent/tools/writeFileTool";
import { editFileTool } from "@/lib/agent/tools/editFileTool";
import { grepTool } from "@/lib/agent/tools/grepTool";
import { globTool } from "@/lib/agent/tools/globTool";

/**
 * Subagent tool set — mirrors open-agents' `executor` subagent
 * (read/write/edit/grep/glob/bash). Explicitly EXCLUDES the parent
 * agent's composite + client-side tools:
 *   - `task` — recursion guard. Subagents are leaves of the agent
 *     tree; nesting them would bloat traces, double cost per spawn,
 *     and risk infinite loops.
 *   - `ask_user_question` — subagents run autonomously without human
 *     input.
 *   - `skill` — subagents execute concrete work; skill loading is the
 *     parent's job.
 *   - `todo_write` — the parent does the planning.
 *   - `web_fetch` — parity with open-agents' executor / explorer /
 *     design subagents, which all omit it.
 */
export function buildSubagentTools() {
  return {
    bash: bashTool,
    read: readFileTool,
    write: writeFileTool,
    edit: editFileTool,
    grep: grepTool,
    glob: globTool,
  };
}
