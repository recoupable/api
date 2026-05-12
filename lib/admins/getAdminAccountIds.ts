import { RECOUP_ORG_ID } from "@/lib/const";
import { selectOrgMemberAccountIds } from "@/lib/supabase/account_organization_ids/selectOrgMemberAccountIds";

/**
 * Returns the subset of `accountIds` that are Recoup admins — i.e. members
 * of the Recoup organization. Mirrors `checkIsAdmin`'s single-account check,
 * batched for use when many accounts need to be classified at once.
 */
export async function getAdminAccountIds(accountIds: string[]): Promise<Set<string>> {
  const ids = await selectOrgMemberAccountIds(RECOUP_ORG_ID, accountIds);
  return new Set(ids);
}
