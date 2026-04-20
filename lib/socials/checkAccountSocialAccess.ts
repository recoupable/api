import { selectAccountSocialsBySocialId } from "@/lib/supabase/account_socials/selectAccountSocialsBySocialId";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";

/**
 * Check if an account has access to a specific social.
 *
 * Access is granted if:
 * 1. The account directly owns the social (row in account_socials), OR
 * 2. The account has access (via checkAccountArtistAccess) to any account
 *    that owns the social — covers shared org + RECOUP_ORG admin bypass.
 *
 * Fails closed: a downstream DB error in selectAccountSocialsBySocialId
 * throws, propagating so the caller surfaces 500 instead of silently
 * denying or granting access.
 *
 * @param accountId - The account ID to check
 * @param socialId - The social ID to check access for
 * @returns true if the account has access to the social, false otherwise
 */
export async function checkAccountSocialAccess(
  accountId: string,
  socialId: string,
): Promise<boolean> {
  const links = await selectAccountSocialsBySocialId(socialId);
  const owningAccountIds = links.map(l => l.account_id).filter((v): v is string => Boolean(v));

  if (!owningAccountIds.length) return false;
  if (owningAccountIds.includes(accountId)) return true;

  const checks = await Promise.all(
    owningAccountIds.map(owner => checkAccountArtistAccess(accountId, owner)),
  );
  return checks.some(Boolean);
}
