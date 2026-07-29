import { tool, type ToolExecutionOptions } from "ai";
import { z } from "zod";
import type { AgentContext } from "@/lib/agent/tools/AgentContext";
import * as path from "path";
import { buildRecoupExecEnv } from "@/lib/agent/tools/buildRecoupExecEnv";
import { getSandbox } from "@/lib/agent/tools/getSandbox";

const TIMEOUT_MS = 120_000;

const bashInputSchema = z.object({
  command: z.string().describe("The bash command to execute"),
  cwd: z
    .string()
    .optional()
    .describe("Workspace-relative working directory for the command (e.g., apps/web)"),
  detached: z
    .boolean()
    .optional()
    .describe(
      "Use this whenever you want to run a persistent server in the background (e.g., npm run dev, next dev). The command starts and returns immediately without waiting for it to finish.",
    ),
});

/**
 * `bash` sandbox tool. Runs `bash -c "<command>"` inside the agent's
 * sandbox via `sandbox.exec`, defaulting cwd to the sandbox's working
 * directory.
 *
 * Approval gating is intentionally absent — model-issued commands are
 * trusted in this PR. Add a host-side gate at the route/UI layer if that
 * changes.
 *
 * Foreground execs receive `RECOUP_ORG_ID` from agent context (when the
 * sandbox is org-scoped) so future `recoup-api` skill calls can scope to
 * the right org. Detached execs deliberately skip env injection — those
 * processes outlive the prompt.
 */
export const bashTool = tool({
  description: `Execute a bash command in the user's shell (non-interactive).

WHEN TO USE:
- Running existing project commands (build, test, lint, typecheck)
- Using read-only CLI tools (git status, git diff, ls, etc.)
- Invoking language/package managers (npm, pnpm, yarn, pip, go, etc.) as part of the task

WHEN NOT TO USE:
- Reading files (use the file read tool instead, once available)
- Editing or creating files (use file edit/write tools, once available)
- Searching code or text (use grep / glob tools, once available)
- Interactive commands (shells, editors, REPLs)

USAGE:
- Runs bash -c "<command>" in a non-interactive shell (no TTY/PTY)
- Commands run in the sandbox working directory by default — do NOT prepend "cd /path &&"
- Use the cwd parameter ONLY with a workspace-relative subdirectory
- Commands automatically timeout after ~2 minutes
- Combined stdout/stderr output is truncated after ~50,000 characters

IMPORTANT:
- Never chain commands with ';' or '&&' — use separate tool calls
- Never use interactive commands (vim, nano, top, bash, ssh, etc.)
- Always quote file paths that may contain spaces
- Use detached: true to start dev servers / long-running processes in the background`,
  inputSchema: bashInputSchema,
  execute: async (
    { command, cwd, detached },
    { context: experimental_context, abortSignal }: ToolExecutionOptions<AgentContext>,
  ) => {
    const sandbox = await getSandbox(experimental_context, "bash");
    const workingDirectory = sandbox.workingDirectory;
    const workingDir = cwd
      ? path.isAbsolute(cwd)
        ? cwd
        : path.resolve(workingDirectory, cwd)
      : workingDirectory;

    if (detached) {
      if (!sandbox.execDetached) {
        return {
          success: false,
          exitCode: null,
          stdout: "",
          stderr:
            "Detached mode is not supported in this sandbox environment. Only cloud sandboxes support background processes.",
        };
      }
      try {
        const { commandId } = await sandbox.execDetached(command, workingDir);
        return {
          success: true,
          exitCode: null,
          stdout: `Process started in background (command ID: ${commandId}). The server is now running.`,
          stderr: "",
        };
      } catch (error) {
        return {
          success: false,
          exitCode: null,
          stdout: "",
          stderr: error instanceof Error ? error.message : String(error),
        };
      }
    }

    const recoupEnv = buildRecoupExecEnv(experimental_context);
    const result = await sandbox.exec(command, workingDir, TIMEOUT_MS, {
      signal: abortSignal,
      ...(recoupEnv ? { env: recoupEnv } : {}),
    });

    return {
      success: result.success,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      ...(result.truncated && { truncated: true }),
    };
  },
});
