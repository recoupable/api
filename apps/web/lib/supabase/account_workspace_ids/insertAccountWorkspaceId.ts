import supabase from "../serverClient";

/**
 * Link a workspace to an owner account.
 *
 * @param accountId - The owner's account ID
 * @param workspaceId - The workspace account ID
 * @returns The created record ID, or null if failed
 */
export async function insertAccountWorkspaceId(
  accountId: string,
  workspaceId: string,
): Promise<string | null> {
  if (!accountId || !workspaceId) return null;

  const { data, error } = await supabase
    .from("account_workspace_ids")
    .insert({
      account_id: accountId,
      workspace_id: workspaceId,
    })
    .select("id")
    .single();

  if (error) {
    return null;
  }

  return data?.id || null;
}
