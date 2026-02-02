import type { Sandbox } from "@vercel/sandbox";

/**
 * Executes a Claude Code prompt in the sandbox.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param prompt - The prompt to send to Claude
 * @throws Error if script execution fails
 */
export async function runClaudeCode(sandbox: Sandbox, prompt: string): Promise<void> {
  const script = `claude --permission-mode acceptEdits --model opus '${prompt}'`;
  
  await sandbox.writeFiles([
    {
      path: "/vercel/sandbox/ralph-once.sh",
      content: Buffer.from(script),
    },
  ]);

  await sandbox.runCommand({
    cmd: "sh",
    args: ["ralph-once.sh"],
    stdout: process.stdout,
    stderr: process.stderr,
    env: {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
    },
  });
}
