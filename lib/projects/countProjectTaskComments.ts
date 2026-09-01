import { selectProjectTaskCommentTaskIds } from "@/lib/supabase/project_task_comments/selectProjectTaskCommentTaskIds";

/**
 * How many comments each of these tasks has, keyed by task id.
 *
 * A task with no comments is absent from the map rather than present as 0;
 * `toProjectTask` supplies the 0.
 */
export async function countProjectTaskComments(taskIds: string[]): Promise<Record<string, number>> {
  if (!taskIds.length) return {};

  const rows = await selectProjectTaskCommentTaskIds(taskIds);

  return rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.task_id] = (counts[row.task_id] ?? 0) + 1;
    return counts;
  }, {});
}
