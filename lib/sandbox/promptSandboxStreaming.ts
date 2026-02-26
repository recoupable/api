import { getOrCreateSandbox } from "./getOrCreateSandbox";

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
 * Yields log chunks as they arrive, then returns the full result.
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

  const { sandbox, sandboxId, created } =
    await getOrCreateSandbox(accountId);

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
