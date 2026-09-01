import { selectProjectTaskComments } from "@/lib/supabase/project_task_comments/selectProjectTaskComments";

/**
 * How many comments each of these tasks has, keyed by task id.
 *
 * A task with no comments is absent from the map rather than present as 0;
 * `toProjectTask` supplies the 0.
 */
export async function countProjectTaskComments(taskIds: string[]): Promise<Record<string, number>> {
  if (!taskIds.length) return {};

  const comments = await selectProjectTaskComments(taskIds);

  return comments.reduce<Record<string, number>>((counts, comment) => {
    counts[comment.task_id] = (counts[comment.task_id] ?? 0) + 1;
    return counts;
  }, {});
}
