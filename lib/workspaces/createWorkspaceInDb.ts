import { insertAccount } from "@/lib/supabase/accounts/insertAccount";
import { insertAccountInfo } from "@/lib/supabase/account_info/insertAccountInfo";
import {
  selectAccountWithSocials,
  type AccountWithSocials,
} from "@/lib/supabase/accounts/selectAccountWithSocials";
import { insertAccountWorkspaceId } from "@/lib/supabase/account_workspace_ids/insertAccountWorkspaceId";
import { addArtistToOrganization } from "@/lib/supabase/artist_organization_ids/addArtistToOrganization";

/**
 * Result of creating a workspace in the database.
 */
export type CreateWorkspaceResult = AccountWithSocials & {
  account_id: string;
  isWorkspace: boolean;
};

/**
 * Create a new workspace account in the database and associate it with an owner account.
 *
 * @param name - Name of the workspace to create
 * @param accountId - ID of the owner account that will have access to this workspace
 * @param organizationId - Optional organization ID to link the new workspace to
 * @returns Created workspace object or null if creation failed
 */
export async function createWorkspaceInDb(
  name: string,
  accountId: string,
  organizationId?: string,
): Promise<CreateWorkspaceResult | null> {
  try {
    const account = await insertAccount({ name });

    const accountInfo = await insertAccountInfo({ account_id: account.id });
    if (!accountInfo) return null;

    const workspace = await selectAccountWithSocials(account.id);
    if (!workspace) return null;

    const linkId = await insertAccountWorkspaceId(accountId, account.id);
    if (!linkId) return null;

    if (organizationId) {
      await addArtistToOrganization(account.id, organizationId);
    }

    return {
      ...workspace,
      account_id: workspace.id,
      isWorkspace: true,
    };
  } catch (error) {
    return null;
  }
}
