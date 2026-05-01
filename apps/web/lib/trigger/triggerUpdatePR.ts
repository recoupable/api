import { tasks } from "@trigger.dev/sdk";

type UpdatePRPayload = {
  feedback: string;
  snapshotId: string;
  branch: string;
  repo: string;
  callbackThreadId: string;
};

/**
 * Triggers the update-pr task to resume a sandbox from snapshot,
 * apply feedback via the AI agent, and push updates to existing PRs.
 *
 * @param payload - The task payload with feedback, snapshot, branch, and PR info
 * @returns The task handle with runId
 */
export async function triggerUpdatePR(payload: UpdatePRPayload) {
  const handle = await tasks.trigger("update-pr", payload);
  return handle;
}
