import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";

// Social access = access to any owning artist. Caller handles existence (404).
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
