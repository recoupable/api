import supabase from "../serverClient";

/**
 * The `task_id` of every comment on these tasks.
 *
 * One read rather than a count per task: the project page renders the whole
 * timeline, so a call each would scale with it.
 */
export async function selectProjectTaskCommentTaskIds(taskIds: string[]) {
  const { data, error } = await supabase
    .from("project_task_comments")
    .select("task_id")
    .in("task_id", taskIds);

  if (error) {
    throw new Error(`Failed to fetch project_task_comments: ${error.message}`);
  }

  return data ?? [];
}
