import { normalizeProfileUrl } from "@/lib/socials/normalizeProfileUrl";
import type { ApifyInstagramProfileResult } from "@/lib/apify/types";
import type { SocialUpsertWithSnapshot } from "@/lib/socials/upsertSocialsWithSnapshot";

/**
 * One Instagram profile item → the socials upsert row (+ snapshot-only
 * postCount). `avatar` defaults to the actor's CDN URL; the artist path
 * passes its Arweave mirror instead.
 *
 * @param profile - Dataset item from apify~instagram-profile-scraper.
 * @param avatar - Override for the avatar URL (Arweave-mirrored for artists).
 */
export function mapInstagramProfileToSocial(
  profile: ApifyInstagramProfileResult,
  avatar?: string | null,
): SocialUpsertWithSnapshot {
  return {
    username: profile.username ?? "",
    profile_url: normalizeProfileUrl(profile.url),
    avatar: avatar ?? profile.profilePicUrl ?? null,
    bio: profile.biography ?? null,
    followerCount: profile.followersCount ?? null,
    followingCount: profile.followsCount ?? null,
    postCount: profile.postsCount ?? null,
  };
}
