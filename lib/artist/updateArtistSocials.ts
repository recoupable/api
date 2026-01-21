import { getSocialPlatformByLink } from "@/lib/artists/getSocialPlatformByLink";
import { getUsernameFromProfileUrl } from "@/lib/socials/getUsernameFromProfileUrl";
import { normalizeProfileUrl } from "@/lib/socials/normalizeProfileUrl";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { deleteAccountSocial } from "@/lib/supabase/account_socials/deleteAccountSocial";
import { insertAccountSocial } from "@/lib/supabase/account_socials/insertAccountSocial";
import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { insertSocials } from "@/lib/supabase/socials/insertSocials";
import type { AccountSocialWithSocial } from "@/lib/supabase/account_socials/selectAccountSocials";

/**
 * Updates artist socials by replacing existing socials for each platform type.
 * Only replaces socials for platforms where a valid URL is provided.
 * Existing socials for platforms not in profileUrls are preserved.
 *
 * @param artistId - The artist account ID
 * @param profileUrls - Record mapping platform types to profile URLs
 * @returns Array of updated account socials with joined social data
 */
export async function updateArtistSocials(
  artistId: string,
  profileUrls: Record<string, string>,
): Promise<AccountSocialWithSocial[]> {
  // Get current account socials (with no limit to get all)
  const accountSocials = await selectAccountSocials(artistId, 0, 10000);

  // Process each platform type
  const profilePromises = Object.entries(profileUrls).map(async ([type, value]) => {
    const normalizedUrl = normalizeProfileUrl(value);

    // Skip if no URL provided - don't delete existing socials without replacement
    if (!normalizedUrl) {
      return;
    }

    const socials = await selectSocials({ profile_url: normalizedUrl });
    const social = socials && socials.length > 0 ? socials[0] : null;

    const existingSocial = (accountSocials || []).find(
      (account_social: AccountSocialWithSocial) =>
        getSocialPlatformByLink(account_social.social?.profile_url || "") === type,
    );

    // Delete existing social for this platform type if it exists
    if (existingSocial && existingSocial.social?.id) {
      await deleteAccountSocial(artistId, existingSocial.social.id);
    }

    // Insert new social
    if (social) {
      // Social already exists, check if account_social relationship exists
      const existing = (accountSocials || []).find(
        (as: AccountSocialWithSocial) => as.social_id === social.id,
      );
      if (!existing) {
        await insertAccountSocial(artistId, social.id);
      }
    } else {
      // Create new social record
      const username = getUsernameFromProfileUrl(value);
      const newSocials = await insertSocials([
        {
          username,
          profile_url: normalizedUrl,
        },
      ]);
      if (newSocials.length > 0) {
        await insertAccountSocial(artistId, newSocials[0].id);
      }
    }
  });

  await Promise.all(profilePromises);

  // Return the updated account socials
  const updated = await selectAccountSocials(artistId, 0, 10000);
  return updated || [];
}
