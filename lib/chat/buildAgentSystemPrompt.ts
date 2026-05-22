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
   * Project-specific custom instructions appended at the end of the
   * prompt (api's existing `agentCustomInstructions` — assistant file
   * link prompt + recoup-api skill prompt).
   */
  customInstructions?: string;
};

/**
 * Assemble the system prompt for `runAgentStep`. Mirrors open-agents'
 * `buildSystemPrompt` (`packages/agent/system-prompt.ts`) at the
 * structural level — environment section → custom instructions — so
 * the agent knows it's in a sandboxed workspace without having to
 * run `pwd` on every prompt.
 *
 * Sections render only when their inputs are provided, so a request
 * without sandbox context (or before sandbox boot) still produces a
 * coherent (env-less) prompt.
 *
 * `currentBranch` handling deliberately omitted in this slim port —
 * the cloud-sandbox checkpointing block in open-agents templates a
 * `git push -u origin {branch}` example per session, but in api's
 * deployment topology the branch is always the org repo's default
 * (`main`), so the per-branch templating doesn't add value yet. Add
 * back when a meaningful per-session branch lands (e.g. xx/abcdef12
 * generated branches).
 */
export function buildAgentSystemPrompt(options: BuildAgentSystemPromptOptions): string {
  const parts: string[] = [];

  if (options.cwd) {
    parts.push(ENVIRONMENT_SECTION);
  }

  if (options.customInstructions) {
    parts.push(options.customInstructions);
  }

  return parts.join("\n\n");
}
