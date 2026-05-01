import { tasks } from "@trigger.dev/sdk";

type PollContentRunPayload = {
  runIds: string[];
  callbackThreadId: string;
};

/**
 * Triggers the poll-content-run task to monitor content creation runs
 * and post results back to the Slack thread via callback.
 *
 * @param payload - The run IDs to poll and the callback thread ID
 * @returns The task handle with runId
 */
export async function triggerPollContentRun(payload: PollContentRunPayload) {
  const handle = await tasks.trigger("poll-content-run", payload);
  return handle;
}
