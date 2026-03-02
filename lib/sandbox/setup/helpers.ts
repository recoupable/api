import type { Sandbox } from "@vercel/sandbox";
import type { SetupDeps } from "./types";

/**
 * Runs a git command in the sandbox and logs on failure.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param args - Git command arguments
 * @param description - Human-readable description for error logging
 * @param deps - Logging dependencies
 * @returns true if the command succeeded, false otherwise
 */
export async function runGitCommand(
  sandbox: Sandbox,
  args: string[],
  description: string,
  deps: SetupDeps,
): Promise<boolean> {
  const result = await sandbox.runCommand({ cmd: "git", args });

  if (result.exitCode !== 0) {
    const stderr = (await result.stderr()) || "";
    const stdout = (await result.stdout()) || "";
    deps.error(`Failed to ${description}`, {
      exitCode: result.exitCode,
      stderr,
      stdout,
    });
    return false;
  }

  return true;
}

interface RunOpenClawAgentOptions {
  label: string;
  message: string;
  env?: Record<string, string>;
}

interface RunOpenClawAgentResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Runs an OpenClaw agent command with standardized logging.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param options - Label for logging, message prompt, optional env vars
 * @param deps - Logging dependencies
 * @returns exitCode, stdout, and stderr from the command
 */
export async function runOpenClawAgent(
  sandbox: Sandbox,
  options: RunOpenClawAgentOptions,
  deps: SetupDeps,
): Promise<RunOpenClawAgentResult> {
  const { label, message, env } = options;

  deps.log(label);

  const commandOpts: Record<string, unknown> = {
    cmd: "openclaw",
    args: ["agent", "--agent", "main", "--message", message],
  };

  if (env) {
    commandOpts.env = env;
  }

  const result = await sandbox.runCommand(commandOpts as Parameters<Sandbox["runCommand"]>[0]);

  const stdout = (await result.stdout()) || "";
  const stderr = (await result.stderr()) || "";

  if (result.exitCode !== 0) {
    deps.error(`${label} failed`, { stderr });
  }

  return {
    exitCode: result.exitCode,
    stdout,
    stderr,
  };
}

/**
 * Installs a skills.sh skill into the OpenClaw workspace skills directory.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param skill - The skills.sh skill identifier (e.g. "recoupable/setup-sandbox")
 * @param deps - Logging dependencies
 */
export async function installSkill(
  sandbox: Sandbox,
  skill: string,
  deps: SetupDeps,
): Promise<void> {
  const skillName = skill.split("/").pop()!;

  deps.log(`Installing skill: ${skill}`);

  const install = await sandbox.runCommand({
    cmd: "npx",
    args: ["skills", "add", skill, "-y"],
  });

  if (install.exitCode !== 0) {
    const stderr = (await install.stderr()) || "";
    deps.error(`Failed to install skill ${skill}`, { stderr });
    throw new Error(`Failed to install skill ${skill} via skills.sh`);
  }

  const copy = await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      `mkdir -p ~/.openclaw/workspace/skills && rm -rf ~/.openclaw/workspace/skills/${skillName} && cp -r .agents/skills/${skillName} ~/.openclaw/workspace/skills/${skillName}`,
    ],
  });

  const copyStderr = (await copy.stderr()) || "";

  if (copy.exitCode !== 0) {
    deps.error(`Failed to copy skill ${skillName}`, { stderr: copyStderr });
    throw new Error(`Failed to copy skill ${skillName} to OpenClaw workspace`);
  }

  deps.log(`Skill installed: ${skillName}`);
}
