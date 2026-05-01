import { tasks } from "@trigger.dev/sdk";

/**
 * Triggers the setup-sandbox task to create a personal sandbox,
 * provision a GitHub repo, take a snapshot, and shut down.
 *
 * @param accountId - The account ID to set up the sandbox for
 * @returns The task handle with runId
 */
export async function triggerSetupSandbox(accountId: string) {
  const handle = await tasks.trigger("setup-sandbox", { accountId });
  return handle;
}
