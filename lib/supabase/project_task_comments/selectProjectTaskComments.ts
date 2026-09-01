import supabase from "../serverClient";

/**
 * Comments on these tasks, oldest first, each carrying its author's account
 * name so a feed renders without a call per row.
 *
 * Takes a list rather than one id so the project page counts every task's
 * comments in a single query instead of one per task; the task page passes a
 * single id.
 */
export async function selectProjectTaskComments(taskIds: string[]) {
  const { data, error } = await supabase
    .from("project_task_comments")
    .select("id, task_id, account_id, body, created_at, accounts(name)")
    .in("task_id", taskIds)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch project_task_comments: ${error.message}`);
  }

  return data ?? [];
}
