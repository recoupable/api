import { selectAccountWorkspaceId } from "./selectAccountWorkspaceId";

/**
 * Check if an account has access to a specific workspace.
 *
 * Access is granted if:
 * 1. Account has direct ownership via account_workspace_ids
 *
 * Fails closed: returns false on any database error to deny access safely.
 *
 * @param accountId - The account ID to check
 * @param workspaceId - The workspace ID to check access for
 * @returns true if the account has access to the workspace, false otherwise
 */
export async function checkAccountWorkspaceAccess(
  accountId: string,
  workspaceId: string,
): Promise<boolean> {
  const data = await selectAccountWorkspaceId(accountId, workspaceId);
  return !!data;
}
