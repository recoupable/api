import { getOrCreateSandbox } from "./getOrCreateSandbox";
import { triggerRunSandboxCommand } from "@/lib/trigger/triggerRunSandboxCommand";

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
  fromSnapshot: boolean;
  runId?: string;
}

/**
 * Streams output from OpenClaw running inside a persistent per-account sandbox.
 *
 * For sandboxes with an existing snapshot, runs the prompt directly and streams output.
 * For fresh sandboxes (no snapshot), triggers the runSandboxCommand background task
 * which handles full setup (OpenClaw install, GitHub repo, etc.) and runs the prompt.
 * Returns immediately with a runId so the caller can track progress without blocking.
 *
 * @param input - The account ID, API key, prompt, and optional abort signal
 * @yields Log chunks with data and stream type (stdout/stderr)
 * @returns The sandbox ID, accumulated output, exit code, whether the sandbox was newly created, and optional runId
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

  // Fresh sandbox: trigger background task for full setup + prompt execution
  if (created && !fromSnapshot) {
    const handle = await triggerRunSandboxCommand({
      command: "openclaw",
      args: ["agent", "--agent", "main", "--message", prompt],
      sandboxId,
      accountId,
    });

    return {
      sandboxId,
      stdout: "",
      stderr: "",
      exitCode: 0,
      created,
      fromSnapshot,
      runId: handle.id,
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
    fromSnapshot,
  };
}
