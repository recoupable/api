import type { ProjectTaskCommentRow } from "@/lib/supabase/project_task_comments/selectProjectTaskComments";

export interface ProjectCommentPayload {
  id: string;
  task_id: string;
  account_id: string;
  author_name: string | null;
  body: string;
  created_at: string;
}

/** A comment as the API returns it, with its author name resolved. */
export function toProjectComment(row: ProjectTaskCommentRow): ProjectCommentPayload {
  return {
    id: row.id,
    task_id: row.task_id,
    account_id: row.account_id,
    author_name: row.accounts?.name ?? null,
    body: row.body,
    created_at: row.created_at,
  };
}
