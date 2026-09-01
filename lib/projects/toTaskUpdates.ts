import { TablesUpdate } from "@/types/database.types";
import type { UpdateProjectTaskBody } from "@/lib/projects/validateUpdateProjectTaskBody";

/**
 * Turn a validated PATCH body into a row update (app#2048).
 *
 * `completed` is the only way completion moves: true stamps `completed_at` from
 * the server clock and records the acting account, false clears both. The
 * caller never supplies either, so who closed an item and when is never the
 * client's word for it.
 *
 * @param body - The validated request body.
 * @param accountId - The authenticated account, recorded as `completed_by`.
 * @returns The columns to write.
 */
export function toTaskUpdates(
  body: UpdateProjectTaskBody,
  accountId: string,
): TablesUpdate<"project_tasks"> {
  const updates: TablesUpdate<"project_tasks"> = {};

  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description ?? null;
  if (body.due_date !== undefined) updates.due_date = body.due_date ?? null;
  if (body.assignee_account_id !== undefined) {
    updates.assignee_account_id = body.assignee_account_id ?? null;
  }

  if (body.completed === true) {
    updates.completed_at = new Date().toISOString();
    updates.completed_by = accountId;
  } else if (body.completed === false) {
    updates.completed_at = null;
    updates.completed_by = null;
  }

  return updates;
}
