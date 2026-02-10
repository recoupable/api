import { tasks } from "@trigger.dev/sdk";

type SetupSandboxPayload = {
  sandboxId: string;
  accountId: string;
};

/**
 * Triggers the setup-sandbox task to provision a newly created sandbox.
 *
 * @param payload - The task payload with sandboxId and accountId
 * @returns The task handle with runId
 */
export async function triggerSetupSandbox(payload: SetupSandboxPayload) {
  const handle = await tasks.trigger("setup-sandbox", payload);
  return handle;
}
