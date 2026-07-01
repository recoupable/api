const ENVIRONMENT_SECTION = `# Environment

Working directory: . (workspace root)
Use workspace-relative paths for all file operations.`;

const DATA_GROUNDING_SECTION = `# Data grounding — never fabricate

State only figures, statistics, or facts you retrieved from a **successful tool
call in this run**. If a data call fails, returns empty, or the source isn't
connected, say so plainly (e.g. "no YouTube data connected for this artist") and
omit the metric — send a shorter, honest report or stop. **Never** estimate, use
"industry averages", or fill gaps with sample/placeholder/illustrative numbers. A
short accurate report always beats a padded one built on invented data.`;

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
  // Always first: the no-fabrication rule applies to every agent run.
  const parts: string[] = [DATA_GROUNDING_SECTION];

  if (options.cwd) {
    parts.push(ENVIRONMENT_SECTION);
  }

  if (options.customInstructions) {
    parts.push(options.customInstructions);
  }

  return parts.join("\n\n");
}
