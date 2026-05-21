import { bashTool } from "@/lib/agent/tools/bashTool";

/**
 * Factory for the full agent tool set passed into `streamText({ tools })`.
 * Each tool reads its sandbox handle + recoup creds from `experimental_context`
 * at execute time — the factory takes no arguments because the tools are
 * stateless modulo that context.
 *
 * Slim PR 4 exposes only `bash`. The remaining sandbox tools (`read`,
 * `write`, `grep`, `glob`, `todo`, `task`, `ask_user_question`, `skill`,
 * `fetch`) port in follow-up PRs and slot into this record one-by-one
 * without changing the factory signature.
 */
export function buildAgentTools() {
  return {
    bash: bashTool(),
  };
}

export type AgentTools = ReturnType<typeof buildAgentTools>;
