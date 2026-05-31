import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { RECOUP_ORG_ID } from "@/lib/const";

/**
 * Returns `true` iff `accountId` is a member of the Recoup organization
 * (`RECOUP_ORG_ID`). Used to grant admin-level scope (read/write across
 * all accounts) to Recoup team members regardless of which auth method
 * they used.
 *
 * Membership is read via `account_organization_ids` so this works for
 * Bearer-authed callers too — `auth.orgId` is only populated by
 * x-api-key org keys, leaving Bearer admins unrecognized if you check
 * `auth.orgId === RECOUP_ORG_ID` alone.
 *
 * `canAccessAccount` deliberately inlines an equivalent check because
 * it reuses the same org-list query for the subsequent shared-org check
 * — calling this helper there would double the DB query for no benefit.
 *
 * @param accountId - The account to check.
 * @returns `true` if the account is in the Recoup org; `false` otherwise.
 */
export async function isRecoupAdmin(accountId: string): Promise<boolean> {
  if (!accountId) return false;
  const orgs = await getAccountOrganizations({ accountId });
  return orgs.some(m => m.organization_id === RECOUP_ORG_ID);
}
