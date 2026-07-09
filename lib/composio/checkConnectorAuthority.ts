import { RECOUP_ORG_ID } from "@/lib/const";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { selectArtistOrganizationIds } from "@/lib/supabase/artist_organization_ids/selectArtistOrganizationIds";
import { selectAccountOrganizationIds } from "@/lib/supabase/account_organization_ids/selectAccountOrganizationIds";
import { selectAccountWorkspaceId } from "@/lib/supabase/account_workspace_ids/selectAccountWorkspaceId";
import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";

/**
 * Check whether a caller has act-as authority over a target account for
 * connector operations (authorize, execute, disconnect, tool exposure).
 *
 * Interim P0b cut (chat#1860): unlike `checkAccountArtistAccess`, this
 * NEVER reads the bare `account_artist_ids` roster edge — a roster row
 * alone must not grant use of another account's OAuth connectors.
 *
 * Authority is granted when:
 * 1. Target is the caller itself, OR
 * 2. Caller is a RECOUP_ORG member (admin bypass), OR
 * 3. Caller shares an organization with the target artist, OR
 * 4. Target is a workspace the caller owns, OR
 * 5. Target is an organization the caller belongs to
 *
 * Fails closed: any database error results in denied authority.
 *
 * @param callerAccountId - The authenticated caller's account ID
 * @param targetAccountId - The account whose connectors are being used
 * @returns true if the caller has connector authority over the target
 */
export async function checkConnectorAuthority(
  callerAccountId: string,
  targetAccountId: string,
): Promise<boolean> {
  // 1. Self-access
  if (targetAccountId === callerAccountId) return true;

  // 2. Admin bypass: RECOUP_ORG staff
  const callerOrgs = await getAccountOrganizations({ accountId: callerAccountId });
  if (callerOrgs.some(m => m.organization_id === RECOUP_ORG_ID)) return true;

  // 3. Org co-membership with a target artist
  const targetOrgs = await selectArtistOrganizationIds(targetAccountId);
  if (targetOrgs?.length) {
    const orgIds = targetOrgs.map(o => o.organization_id).filter((id): id is string => Boolean(id));
    if (orgIds.length) {
      const sharedOrgs = await selectAccountOrganizationIds(callerAccountId, orgIds);
      if (sharedOrgs?.length) return true;
    }
  }

  // 4. Workspace owned by the caller
  const isWorkspace = await selectAccountWorkspaceId(callerAccountId, targetAccountId);
  if (isWorkspace) return true;

  // 5. Organization the caller belongs to
  return validateOrganizationAccess({
    accountId: callerAccountId,
    organizationId: targetAccountId,
  });
}
