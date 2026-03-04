import { tasks } from "@trigger.dev/sdk";
import { CREATE_CONTENT_TASK_ID } from "@/lib/const";

export interface TriggerCreateContentPayload {
  accountId: string;
  artistSlug: string;
  template: string;
  lipsync: boolean;
}

/**
 * Triggers the create-content task in Trigger.dev.
 *
 * @param payload
 */
export async function triggerCreateContent(payload: TriggerCreateContentPayload) {
  const handle = await tasks.trigger(CREATE_CONTENT_TASK_ID, payload);
  return handle;
}
