import supabase from "../serverClient";

/**
 * Select a single account_workspace_ids row for a specific account and workspace.
 *
 * @param accountId - The account ID
 * @param workspaceId - The workspace ID
 * @returns The row if found, null if not found or on error
 */
export async function selectAccountWorkspaceId(
  accountId: string,
  workspaceId: string,
) {
  const { data, error } = await supabase
    .from("account_workspace_ids")
    .select("workspace_id")
    .eq("account_id", accountId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data;
}
