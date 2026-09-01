import { selectProjectCollaborator } from "@/lib/supabase/project_collaborators/selectProjectCollaborator";

/**
 * Whether an account may read or write a project (app#2048).
 *
 * Every endpoint under `/api/projects` calls this, and a false answer is a 404
 * rather than a 403 — a 403 confirms the project id is real, which is exactly
 * what an unguessable id must not do.
 *
 * A lookup failure denies. Treating a database error as access would turn one
 * bad minute into a disclosure.
 */
export async function hasProjectAccess(projectId: string, accountId: string): Promise<boolean> {
  try {
    return Boolean(await selectProjectCollaborator(projectId, accountId));
  } catch (error) {
    console.error("Failed to resolve project access:", error);
    return false;
  }
}
