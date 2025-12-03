import { Tables } from "@/types/database.types";
import type { AccountSocialWithSocial } from "@/lib/supabase/account_socials/selectAccountSocials";

type AccountSocialRow = Tables<"account_socials">;
type SocialRow = Tables<"socials">;

export type AccountSocialResponse = Pick<AccountSocialRow, "id" | "social_id"> &
  Pick<SocialRow, "username" | "profile_url" | "avatar" | "bio" | "region" | "updated_at"> & {
    follower_count: SocialRow["followerCount"];
    following_count: SocialRow["followingCount"];
  };

/**
 * Transforms Supabase query results into the expected ArtistSocialResponse format.
 *
 * @param accountSocials - The raw query results from Supabase with joined social data
 * @returns Array of transformed social responses
 * @throws Error if social data is missing for any account_social
 */
export function flattenAccountSocials(
  accountSocials: AccountSocialWithSocial[] | null,
): AccountSocialResponse[] {
  return (accountSocials || []).map(item => {
    const accountSocial = item;
    const socialData = accountSocial.social as unknown as SocialRow;
    if (!socialData) {
      throw new Error(`No social data found for account_social id: ${accountSocial.id}`);
    }
    return {
      id: accountSocial.id,
      social_id: accountSocial.social_id,
      username: socialData.username,
      profile_url: socialData.profile_url,
      avatar: socialData.avatar,
      bio: socialData.bio,
      follower_count: socialData.followerCount,
      following_count: socialData.followingCount,
      region: socialData.region,
      updated_at: socialData.updated_at,
    };
  });
}
