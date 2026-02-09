import { tasks } from "@trigger.dev/sdk";

type SetupSandboxPayload = {
  sandboxId: string;
  accountId: string;
};

/**
 * Triggers the setup-sandbox task to set up GitHub repo in the background.
 *
 * @param payload - The task payload with sandboxId and accountId
 * @returns The task handle
 */
export async function triggerSetupSandbox(payload: SetupSandboxPayload) {
  const handle = await tasks.trigger("setup-sandbox", payload);
  return handle;
}
