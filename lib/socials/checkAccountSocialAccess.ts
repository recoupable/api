import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";

// Socials are always owned by artist accounts (never directly by user accounts),
// so access is gated entirely through checkAccountArtistAccess against each
// owning artist — covers direct membership, shared org, and RECOUP_ORG admin.
//
// Caller still owns the existence check: selectSocials(id) → 404 stays inline
// in the validator so the helper only answers the access question. Keeps the
// helper's contract identical to checkAccountArtistAccess (returns boolean).
export async function checkAccountSocialAccess(
  accountId: string,
  socialId: string,
): Promise<boolean> {
  const links = await selectAccountSocials({ socialId, limit: 10000 });
  const owningArtistIds = links.map(l => l.account_id).filter((v): v is string => Boolean(v));

  if (!owningArtistIds.length) return false;

  const results = await Promise.all(
    owningArtistIds.map(artistId => checkAccountArtistAccess(accountId, artistId)),
  );
  return results.some(Boolean);
}
