import supabase from "../serverClient";
import { Tables } from "@/types/database.types";

/**
 * One collaborator row, or null when the account has no access to the project.
 *
 * This single lookup is the whole authorization model for `/api/projects/*`
 * (app#2048): access is a row, not a flag on the project and not a list in
 * source. The unique (project_id, account_id) index makes it one index hit.
 */
export async function selectProjectCollaborator(
  projectId: string,
  accountId: string,
): Promise<Tables<"project_collaborators"> | null> {
  const { data, error } = await supabase
    .from("project_collaborators")
    .select("*")
    .eq("project_id", projectId)
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch project_collaborators: ${error.message}`);
  }

  return data;
}
