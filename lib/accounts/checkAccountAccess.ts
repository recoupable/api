import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

/**
 * Check if an account has access to another account.
 *
 * Access is granted if:
 * 1. `accountId` is the same account as `targetAccountId` (self-access), OR
 * 2. `accountId` is a member of RECOUP_ORG (admin bypass), OR
 * 3. `accountId` and `targetAccountId` share at least one organization.
 *
 * Fails closed: `canAccessAccount` returns `false` on any missing membership
 * or database error, so a bare authenticated caller cannot read arbitrary
 * accounts' data.
 *
 * Mirrors `checkAccountArtistAccess` / `checkAccountSocialAccess` so every
 * account-scoped endpoint can follow the same `selectAccounts -> 404 +
 * check*Access -> 403` validator pattern.
 *
 * @param accountId - The requester's account ID (from `validateAuthContext`)
 * @param targetAccountId - The account ID being accessed
 * @returns true if the requester can access the target account, false otherwise
 */
export async function checkAccountAccess(
  accountId: string,
  targetAccountId: string,
): Promise<boolean> {
  return canAccessAccount({
    currentAccountId: accountId,
    targetAccountId,
  });
}
