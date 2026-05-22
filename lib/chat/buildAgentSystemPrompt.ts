import { renderCloudSandboxInstructions } from "@/lib/chat/cloudSandboxInstructions";

const ENVIRONMENT_SECTION = `# Environment

Working directory: . (workspace root)
Use workspace-relative paths for all file operations.`;

export type BuildAgentSystemPromptOptions = {
  /**
   * Sandbox working directory. Triggers inclusion of the Environment
   * section. The literal value isn't exposed to the model — the
   * section just signals "you're in a workspace; use relative paths"
   * (mirrors open-agents).
   */
  cwd?: string;
  /**
   * Current git branch on the sandbox checkout. Triggers inclusion of
   * `Current branch: <branch>` plus the cloud-sandbox checkpointing
   * block, with the branch substituted into the example `git push`
   * command.
   */
  currentBranch?: string;
  /**
   * Project-specific custom instructions appended at the end of the
   * prompt (api's existing `agentCustomInstructions` — assistant file
   * link prompt + recoup-api skill prompt).
   */
  customInstructions?: string;
};

/**
 * Assemble the system prompt for `runAgentStep`. Mirrors open-agents'
 * `buildSystemPrompt` (`packages/agent/system-prompt.ts`) at the
 * structural level — environment section → branch info → cloud
 * sandbox checkpointing → custom instructions — so the agent knows
 * its execution context without having to run `pwd` / `git branch`
 * on every prompt.
 *
 * Sections render only when their inputs are provided, so a request
 * without sandbox context (or before sandbox boot) still produces a
 * coherent (env-less) prompt.
 */
export function buildAgentSystemPrompt(options: BuildAgentSystemPromptOptions): string {
  const parts: string[] = [];

  if (options.cwd) {
    parts.push(ENVIRONMENT_SECTION);
  }

  if (options.currentBranch) {
    parts.push(`Current branch: ${options.currentBranch}`);
    parts.push(renderCloudSandboxInstructions(options.currentBranch));
  }

  if (options.customInstructions) {
    parts.push(options.customInstructions);
  }

  return parts.join("\n\n");
}
