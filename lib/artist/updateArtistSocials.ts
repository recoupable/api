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
 *
 * @param artistId - The artist account ID
 * @param profileUrls - Record mapping platform types to profile URLs
 * @returns Array of updated account socials with joined social data
 */
export async function updateArtistSocials(
  artistId: string,
  profileUrls: Record<string, string>,
): Promise<AccountSocialWithSocial[]> {
  console.log("[DEBUG] updateArtistSocials called with:", { artistId, profileUrls });

  // Get current account socials (with no limit to get all)
  const accountSocials = await selectAccountSocials(artistId, 0, 10000);
  console.log("[DEBUG] Current accountSocials:", accountSocials?.length || 0);

  // Process each platform type
  const profilePromises = Object.entries(profileUrls).map(async ([type, value]) => {
    const normalizedUrl = normalizeProfileUrl(value);
    console.log("[DEBUG] Processing platform:", { type, value, normalizedUrl });

    const socials = normalizedUrl
      ? await selectSocials({ profile_url: normalizedUrl })
      : null;
    const social = socials && socials.length > 0 ? socials[0] : null;
    console.log("[DEBUG] Existing social found:", social?.id || "none");

    const existingSocial = (accountSocials || []).find(
      (account_social: AccountSocialWithSocial) =>
        getSocialPlatformByLink(account_social.social?.profile_url || "") === type,
    );
    console.log("[DEBUG] Existing account_social for platform:", existingSocial?.id || "none");

    // Delete existing social for this platform type if it exists
    if (existingSocial && existingSocial.social?.id) {
      console.log("[DEBUG] Deleting existing account_social:", existingSocial.social.id);
      await deleteAccountSocial(artistId, existingSocial.social.id);
    }

    // Insert new social if URL provided
    if (normalizedUrl) {
      if (social) {
        // Social already exists, check if account_social relationship exists
        const existing = (accountSocials || []).find(
          (as: AccountSocialWithSocial) => as.social_id === social.id,
        );
        console.log("[DEBUG] Social exists, account_social exists:", !!existing);
        if (!existing) {
          const inserted = await insertAccountSocial(artistId, social.id);
          console.log("[DEBUG] Inserted account_social:", inserted?.id || "failed");
        }
      } else {
        // Create new social record
        const username = getUsernameFromProfileUrl(value);
        console.log("[DEBUG] Creating new social with username:", username);
        const newSocials = await insertSocials([
          {
            username,
            profile_url: normalizedUrl,
          },
        ]);
        console.log("[DEBUG] insertSocials result:", newSocials.length, newSocials);
        if (newSocials.length > 0) {
          const inserted = await insertAccountSocial(artistId, newSocials[0].id);
          console.log("[DEBUG] Inserted account_social for new social:", inserted?.id || "failed");
        } else {
          console.log("[DEBUG] insertSocials returned empty - insert may have failed");
        }
      }
    }
  });

  await Promise.all(profilePromises);

  // Return the updated account socials
  const updated = await selectAccountSocials(artistId, 0, 10000);
  console.log("[DEBUG] Final updated accountSocials:", updated?.length || 0, updated);
  return updated || [];
}
