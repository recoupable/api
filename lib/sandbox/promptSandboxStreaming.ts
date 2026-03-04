import { getOrCreateSandbox } from "./getOrCreateSandbox";
import { triggerRunSandboxCommand } from "@/lib/trigger/triggerRunSandboxCommand";
import { pollTaskRun } from "@/lib/trigger/pollTaskRun";

interface PromptSandboxStreamingInput {
  accountId: string;
  apiKey: string;
  prompt: string;
  abortSignal?: AbortSignal;
}

interface PromptSandboxStreamingResult {
  sandboxId: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  created: boolean;
}

/**
 * Streams output from OpenClaw running inside a persistent per-account sandbox.
 *
 * For sandboxes with an existing snapshot, runs the prompt directly and streams output.
 * For fresh sandboxes (no snapshot), delegates to the runSandboxCommand background task
 * which handles full setup (OpenClaw install, GitHub repo, etc.) before running the prompt.
 *
 * @param input - The account ID, API key, prompt, and optional abort signal
 * @yields Log chunks with data and stream type (stdout/stderr)
 * @returns The sandbox ID, accumulated output, exit code, and whether the sandbox was newly created
 */
export async function* promptSandboxStreaming(
  input: PromptSandboxStreamingInput,
): AsyncGenerator<
  { data: string; stream: "stdout" | "stderr" },
  PromptSandboxStreamingResult,
  undefined
> {
  const { accountId, apiKey, prompt, abortSignal } = input;

  const { sandbox, sandboxId, created, fromSnapshot } = await getOrCreateSandbox(accountId);

  // Fresh sandbox: delegate to background task for full setup + prompt execution
  if (created && !fromSnapshot) {
    yield {
      data: "Setting up your sandbox for the first time...\n",
      stream: "stderr" as const,
    };

    const handle = await triggerRunSandboxCommand({
      command: "openclaw",
      args: ["agent", "--agent", "main", "--message", prompt],
      sandboxId,
      accountId,
    });

    const run = await pollTaskRun(handle.id);
    const output = run.output as {
      stdout: string;
      stderr: string;
      exitCode: number;
    };

    return {
      sandboxId,
      stdout: output.stdout,
      stderr: output.stderr,
      exitCode: output.exitCode,
      created,
    };
  }

  // Existing setup: run prompt directly and stream output
  const cmd = await sandbox.runCommand({
    cmd: "openclaw",
    args: ["agent", "--agent", "main", "--message", prompt],
    env: {
      RECOUP_API_KEY: apiKey,
    },
    detached: true,
  });

  let stdout = "";
  let stderr = "";

  for await (const log of cmd.logs({ signal: abortSignal })) {
    if (log.stream === "stdout") {
      stdout += log.data;
    } else {
      stderr += log.data;
    }
    yield log;
  }

  const { exitCode } = await cmd.wait();

  return {
    sandboxId,
    stdout,
    stderr,
    exitCode,
    created,
  };
}
