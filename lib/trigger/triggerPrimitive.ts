import { tasks } from "@trigger.dev/sdk";

/**
 * Triggers a Trigger.dev primitive task by ID.
 *
 * @param taskId - The Trigger.dev task identifier.
 * @param payload - The task payload.
 * @returns The task handle with run ID.
 */
export async function triggerPrimitive(taskId: string, payload: Record<string, unknown>) {
  return tasks.trigger(taskId, payload);
}
