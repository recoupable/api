import { bashTool } from "@/lib/agent/tools/bashTool";
import { readFileTool } from "@/lib/agent/tools/readFileTool";
import { writeFileTool } from "@/lib/agent/tools/writeFileTool";
import { editFileTool } from "@/lib/agent/tools/editFileTool";
import { grepTool } from "@/lib/agent/tools/grepTool";
import { globTool } from "@/lib/agent/tools/globTool";
import { todoWriteTool } from "@/lib/agent/tools/todoWriteTool";
import { webFetchTool } from "@/lib/agent/tools/webFetchTool";

/**
 * Factory for the full agent tool set passed into `streamText({ tools })`.
 * Each tool reads its sandbox handle + recoup creds from `experimental_context`
 * at execute time — the factory takes no arguments because the tools are
 * stateless modulo that context.
 *
 * Currently ships 8 leaf tools:
 *   - bash, read, write, edit, grep, glob (sandbox / file ops)
 *   - todo_write (planning surface; stateless, echoes the list back)
 *   - web_fetch (HTTP via curl inside the sandbox)
 *
 * Composite tools (`task` subagent, `ask_user_question` UI part,
 * `skill` skill discovery) port in a follow-up PR — they require
 * subagent context plumbing / UI rendering / skill discovery infra
 * that isn't in api today.
 */
export function buildAgentTools() {
  return {
    bash: bashTool(),
    read: readFileTool(),
    write: writeFileTool(),
    edit: editFileTool(),
    grep: grepTool(),
    glob: globTool(),
    todo_write: todoWriteTool,
    web_fetch: webFetchTool,
  };
}

export type AgentTools = ReturnType<typeof buildAgentTools>;
