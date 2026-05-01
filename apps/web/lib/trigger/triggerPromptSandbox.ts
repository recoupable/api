import { tasks } from "@trigger.dev/sdk";

type PromptSandboxPayload = {
  prompt: string;
  sandboxId: string;
  accountId: string;
};

/**
 * Triggers the run-sandbox-command task to execute an OpenClaw prompt in a sandbox.
 *
 * @param payload - The task payload with prompt, sandboxId, and accountId
 * @returns The task handle with runId
 */
export async function triggerPromptSandbox(payload: PromptSandboxPayload) {
  const handle = await tasks.trigger("run-sandbox-command", {
    command: "openclaw",
    args: ["agent", "--agent", "main", "--message", payload.prompt],
    sandboxId: payload.sandboxId,
    accountId: payload.accountId,
  });
  return handle;
}
