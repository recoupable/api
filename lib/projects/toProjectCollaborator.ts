import type { ProjectCollaboratorRow } from "@/lib/supabase/project_collaborators/selectProjectCollaborators";

export interface ProjectCollaboratorPayload {
  account_id: string;
  name: string | null;
}

/**
 * A collaborator as the API returns it.
 *
 * `name` comes from the account and is null for most of them — nothing captures
 * a name at sign-up today — so it is documented nullable and clients render a
 * fallback rather than a blank.
 */
export function toProjectCollaborator(row: ProjectCollaboratorRow): ProjectCollaboratorPayload {
  return { account_id: row.account_id, name: row.accounts?.name ?? null };
}
