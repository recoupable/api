/**
 * Cloud-sandbox checkpointing instructions injected into the system
 * prompt when `currentBranch` is known. Mirrors open-agents'
 * `CLOUD_SANDBOX_INSTRUCTIONS` (`packages/agent/system-prompt.ts`)
 * — the `{branch}` placeholder is substituted with the live branch
 * name before injection.
 *
 * The block tells the model: this sandbox is ephemeral; commit + push
 * frequently because work is lost when the session ends. Without it
 * the model can't know to checkpoint its work, which surfaces as
 * "I made these changes" assistant replies whose changes evaporate
 * after the sandbox tears down.
 */
const CLOUD_SANDBOX_INSTRUCTIONS = `# Cloud Sandbox

Your sandbox is ephemeral. All work is lost when the session ends unless committed and pushed to git.

## Checkpointing Rules

1. **Commit after every meaningful change** — new file, completed function, fixed bug
2. **Push immediately after each commit** — do not batch commits
3. **Commit BEFORE long operations** — package installs, builds, test runs
4. **Use clear WIP messages** — "WIP: add user authentication endpoint"
5. **When in doubt, checkpoint** — it is better to have extra commits than lost work

## Git Workflow

- Push with: \`git push -u origin {branch}\`
- Your work is only safe once pushed to remote
- If push fails, retry once then report the failure — do not proceed with more work until push succeeds

## On Task Completion

- Squash WIP commits into logical units if appropriate
- Write a final commit message summarizing changes
- Ensure all changes are pushed before reporting completion`;

/**
 * Render the cloud-sandbox checkpointing block with a real branch
 * name substituted into the `{branch}` placeholder inside the
 * `git push` example.
 */
export function renderCloudSandboxInstructions(branch: string): string {
  return CLOUD_SANDBOX_INSTRUCTIONS.replace("{branch}", branch);
}
