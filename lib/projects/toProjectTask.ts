import { Tables } from "@/types/database.types";

export type ProjectTaskPayload = Tables<"project_tasks"> & {
  comment_count: number;
};

/**
 * A task row as the API returns it, with its comment count folded in so a list
 * can render a count without a call per task.
 */
export function toProjectTask(
  row: Tables<"project_tasks">,
  commentCounts: Record<string, number>,
): ProjectTaskPayload {
  return { ...row, comment_count: commentCounts[row.id] ?? 0 };
}
