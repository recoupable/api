import supabase from "../serverClient";
import type { ProjectTaskCommentRow } from "./selectProjectTaskComments";

/**
 * Post a comment on a task, returning it with its author's account name so the
 * caller can render the new row without a second read.
 */
export async function insertProjectTaskComment(
  taskId: string,
  accountId: string,
  body: string,
): Promise<ProjectTaskCommentRow> {
  const { data, error } = await supabase
    .from("project_task_comments")
    .insert({ task_id: taskId, account_id: accountId, body })
    .select("id, task_id, account_id, body, created_at, accounts(name)")
    .single();

  if (error) {
    throw new Error(`Failed to insert project_task_comments: ${error.message}`);
  }

  return data as unknown as ProjectTaskCommentRow;
}
