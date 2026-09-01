import supabase from "../serverClient";

export interface ProjectCollaboratorRow {
  account_id: string;
  accounts: { name: string | null } | null;
}

/** Everyone with access to a project, with their account name for display. */
export async function selectProjectCollaborators(
  projectId: string,
): Promise<ProjectCollaboratorRow[]> {
  const { data, error } = await supabase
    .from("project_collaborators")
    .select("account_id, accounts(name)")
    .eq("project_id", projectId);

  if (error) {
    throw new Error(`Failed to fetch project_collaborators: ${error.message}`);
  }

  return (data ?? []) as unknown as ProjectCollaboratorRow[];
}
