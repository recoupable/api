import { tasks } from "@trigger.dev/sdk";

/**
 * Triggers a Trigger.dev primitive task by ID.
 */
export async function triggerPrimitive(taskId: string, payload: Record<string, unknown>) {
  return tasks.trigger(taskId, payload);
}
