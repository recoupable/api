import { getOrCreateSandbox } from "./getOrCreateSandbox";
import { setupFreshSandbox } from "@/lib/sandbox/setup/setupFreshSandbox";
import { pushSandboxToGithub } from "@/lib/sandbox/setup/pushSandboxToGithub";
import { upsertAccountSnapshot } from "@/lib/supabase/account_snapshots/upsertAccountSnapshot";
import type { SetupDeps } from "@/lib/sandbox/setup/types";

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
 * For fresh sandboxes (no snapshot), runs the full setup pipeline inline first.
 * After prompt completion on fresh sandboxes, pushes to GitHub and snapshots.
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

  const isFreshSandbox = created && !fromSnapshot;
  let githubRepo: string | undefined;

  // Run inline setup for fresh sandboxes
  if (isFreshSandbox) {
    const setupGen = setupFreshSandbox({ sandbox, accountId, apiKey });

    while (true) {
      const next = await setupGen.next();
      if (next.done) {
        githubRepo = next.value;
        break;
      }
      yield next.value;
    }
  }

  // Execute the user's prompt
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

  // Post-prompt: push to GitHub and snapshot for fresh sandboxes
  if (isFreshSandbox) {
    const deps: SetupDeps = {
      log: msg => console.log(`[PostSetup] ${msg}`),
      error: (msg, data) => console.error(`[PostSetup] ${msg}`, data),
    };

    await pushSandboxToGithub(sandbox, deps);

    const snapshotResult = await sandbox.snapshot();
    await upsertAccountSnapshot({
      account_id: accountId,
      snapshot_id: snapshotResult.snapshotId,
      github_repo: githubRepo,
    });
  }

  return {
    sandboxId,
    stdout,
    stderr,
    exitCode,
    created,
  };
}
