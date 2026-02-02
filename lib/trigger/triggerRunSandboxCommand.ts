import { tasks } from "@trigger.dev/sdk";

type RunSandboxCommandPayload = {
  prompt: string;
  sandboxId: string;
};

/**
 * Triggers the run-sandbox-command task to execute a prompt in a sandbox.
 *
 * @param payload - The task payload with prompt and sandboxId
 * @returns The task handle
 */
export async function triggerRunSandboxCommand(payload: RunSandboxCommandPayload) {
  const handle = await tasks.trigger("run-sandbox-command", payload);
  return handle;
}
