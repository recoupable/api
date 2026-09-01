import supabase from "../serverClient";

/** Everyone with access to a project, with their account name for display. */
export async function selectProjectCollaborators(projectId: string) {
  const { data, error } = await supabase
    .from("project_collaborators")
    .select("account_id, accounts(name)")
    .eq("project_id", projectId);

  if (error) {
    throw new Error(`Failed to fetch project_collaborators: ${error.message}`);
  }

  return data ?? [];
}
