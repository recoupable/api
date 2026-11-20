const AGENT_PREFIX = "/tmp/board-agent";

/**
 * Builds the shell script Claude's board sandbox runs. It installs vb and
 * Claude Code under a local prefix, then lets `vb tasks run` claim the task
 * by ID, renew its lease, and settle it by Claude's exit code. The task ID
 * and prompt arrive as environment variables, so no board text is
 * interpolated into the script.
 *
 * @returns The bash script.
 */
export function buildClaudeSandboxScript(): string {
  return [
    "set -eu",
    `npm install --prefix ${AGENT_PREFIX} --no-fund --no-audit @vercel/board@0.52.0 @anthropic-ai/claude-code`,
    `export PATH="${AGENT_PREFIX}/node_modules/.bin:$PATH"`,
    'vb tasks run "$TASK_ID" --lease 5m --result "Claude replied in the thread" -- \\',
    '  claude -p "$CLAUDE_PROMPT" --allowedTools "Bash(vb:*)" --max-turns 30',
  ].join("\n");
}
