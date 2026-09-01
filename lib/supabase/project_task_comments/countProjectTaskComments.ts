import supabase from "../serverClient";

/**
 * How many comments each of these tasks has.
 *
 * One grouped read rather than a count per task: the project page renders every
 * task and a call each would scale with the timeline.
 */
export async function countProjectTaskComments(taskIds: string[]): Promise<Record<string, number>> {
  if (!taskIds.length) return {};

  const { data, error } = await supabase
    .from("project_task_comments")
    .select("task_id")
    .in("task_id", taskIds);

  if (error) {
    throw new Error(`Failed to count project_task_comments: ${error.message}`);
  }

  return (data ?? []).reduce<Record<string, number>>((counts, row) => {
    counts[row.task_id] = (counts[row.task_id] ?? 0) + 1;
    return counts;
  }, {});
}
