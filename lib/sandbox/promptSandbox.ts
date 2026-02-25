import { getOrCreateSandbox } from "./getOrCreateSandbox";

interface PromptSandboxInput {
  accountId: string;
  apiKey: string;
  prompt: string;
}

interface PromptSandboxResult {
  sandboxId: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  created: boolean;
}

/**
 * Sends a prompt to OpenClaw running inside a persistent per-account sandbox.
 * Reuses an existing running sandbox or creates one from the latest snapshot.
 * The sandbox stays alive after the prompt for follow-up prompts.
 *
 * @param input - The account ID and prompt to run
 * @returns The sandbox ID, command output, and whether the sandbox was newly created
 */
export async function promptSandbox(
  input: PromptSandboxInput,
): Promise<PromptSandboxResult> {
  const { accountId, apiKey, prompt } = input;

  const { sandbox, sandboxId, created } =
    await getOrCreateSandbox(accountId);

  const commandResult = await sandbox.runCommand({
    cmd: "openclaw",
    args: ["agent", "--agent", "main", "--message", prompt],
    env: {
      RECOUP_API_KEY: apiKey,
      RECOUP_ACCOUNT_ID: accountId,
    },
  });

  const stdout = (await commandResult.stdout()) || "";
  const stderr = (await commandResult.stderr()) || "";

  return {
    sandboxId,
    stdout,
    stderr,
    exitCode: commandResult.exitCode,
    created,
  };
}
