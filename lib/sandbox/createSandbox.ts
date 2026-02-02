import ms from "ms";
import { Sandbox } from "@vercel/sandbox";
import { installClaudeCode } from "./installClaudeCode";
import { runClaudeCode } from "./runClaudeCode";

export interface SandboxCreatedResponse {
  sandboxId: Sandbox["sandboxId"];
  sandboxStatus: Sandbox["status"];
  timeout: Sandbox["timeout"];
  createdAt: string;
}

/**
 * Creates a Vercel Sandbox, installs Claude Code CLI and Anthropic SDK, then executes a prompt.
 *
 * @param prompt - The prompt to send to Claude
 * @returns The sandbox creation response
 * @throws Error if sandbox creation or dependency installation fails
 */
export async function createSandbox(prompt: string): Promise<SandboxCreatedResponse> {
  const sandbox = await Sandbox.create({
    resources: { vcpus: 4 },
    timeout: ms("10m"),
    runtime: "node22",
  });

  try {
    await installClaudeCode(sandbox);
    await runClaudeCode(sandbox, prompt);

    return {
      sandboxId: sandbox.sandboxId,
      sandboxStatus: sandbox.status,
      timeout: sandbox.timeout,
      createdAt: sandbox.createdAt.toISOString(),
    };
  } finally {
    await sandbox.stop();
  }
}
