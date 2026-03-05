import { tasks } from "@trigger.dev/sdk";
import { CREATE_CONTENT_TASK_ID } from "@/lib/const";

export interface TriggerCreateContentPayload {
  accountId: string;
  artistSlug: string;
  template: string;
  lipsync: boolean;
  /** GitHub repo URL so the task can fetch artist files. */
  githubRepo: string;
}

/**
 * Triggers the create-content task in Trigger.dev.
 */
export async function triggerCreateContent(payload: TriggerCreateContentPayload) {
  const handle = await tasks.trigger(CREATE_CONTENT_TASK_ID, payload);
  return handle;
}

