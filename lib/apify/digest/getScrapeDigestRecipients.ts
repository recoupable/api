import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { getAccountArtistIds } from "@/lib/supabase/account_artist_ids/getAccountArtistIds";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

/**
 * Resolves the digest recipients for a set of scraped socials: every owner
 * of every artist watching any of them (same chain the per-platform alert
 * used). Recipients span tenants — senders must BCC (chat#1855).
 */
export async function getScrapeDigestRecipients(socialIds: string[]): Promise<string[]> {
  const uniqueSocialIds = Array.from(new Set(socialIds.filter(Boolean)));
  if (!uniqueSocialIds.length) return [];

  const accountSocials = (
    await Promise.all(
      uniqueSocialIds.map(socialId => selectAccountSocials({ socialId, limit: 10000 })),
    )
  ).flat();

  const accountArtistIds = await getAccountArtistIds({
    artistIds: accountSocials.map(a => a.account_id),
  });
  const uniqueAccountIds = Array.from(
    new Set(accountArtistIds.map(a => a.account_id).filter((id): id is string => Boolean(id))),
  );
  const accountEmails = await selectAccountEmails({ accountIds: uniqueAccountIds });
  return Array.from(new Set(accountEmails.map(e => e.email).filter(Boolean)));
}
