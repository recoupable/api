import supabase from "../serverClient";

export interface ProjectTaskCommentRow {
  id: string;
  task_id: string;
  account_id: string;
  body: string;
  created_at: string;
  accounts: { name: string | null } | null;
}

/**
 * A task's comments, oldest first, each carrying its author's account name so
 * the feed renders without a call per row.
 */
export async function selectProjectTaskComments(taskId: string): Promise<ProjectTaskCommentRow[]> {
  const { data, error } = await supabase
    .from("project_task_comments")
    .select("id, task_id, account_id, body, created_at, accounts(name)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch project_task_comments: ${error.message}`);
  }

  return (data ?? []) as unknown as ProjectTaskCommentRow[];
}
