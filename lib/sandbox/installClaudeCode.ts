import type { Sandbox } from "@vercel/sandbox";

/**
 * Installs Claude Code CLI and Anthropic SDK in the sandbox.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @throws Error if installation fails
 */
export async function installClaudeCode(sandbox: Sandbox): Promise<void> {
  const installCLI = await sandbox.runCommand({
    cmd: "npm",
    args: ["install", "-g", "@anthropic-ai/claude-code"],
    stderr: process.stderr,
    stdout: process.stdout,
    sudo: true,
  });

  if (installCLI.exitCode !== 0) {
    throw new Error("Failed to install Claude Code CLI");
  }

  const installSDK = await sandbox.runCommand({
    cmd: "npm",
    args: ["install", "@anthropic-ai/sdk"],
    stderr: process.stderr,
    stdout: process.stdout,
  });

  if (installSDK.exitCode !== 0) {
    throw new Error("Failed to install Anthropic SDK");
  }
}
