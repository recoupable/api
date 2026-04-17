import supabase from "@/lib/supabase/serverClient";

export interface SocialByIdProjection {
  id: string;
  username: string | null;
  avatar: string | null;
  profile_url: string | null;
  region: string | null;
  bio: string | null;
  followerCount: number | null;
  followingCount: number | null;
  updated_at: string | null;
}

export interface SelectSocialsByIdsResponse {
  status: "success" | "error";
  socials: SocialByIdProjection[];
}

/**
 * Fetches socials by IDs using a 9-field projection.
 *
 * @param socialIds - Array of social IDs
 * @returns An object containing the status and the matching socials
 */
export async function selectSocialsByIds(socialIds: string[]): Promise<SelectSocialsByIdsResponse> {
  try {
    if (!socialIds.length) {
      return {
        status: "success",
        socials: [],
      };
    }

    const { data, error } = await supabase
      .from("socials")
      .select(
        "id, username, avatar, profile_url, region, bio, followerCount, followingCount, updated_at",
      )
      .in("id", socialIds);

    if (error) {
      console.error("[ERROR] Error fetching socials by ids:", error);
      return {
        status: "error",
        socials: [],
      };
    }

    return {
      status: "success",
      socials: (data || []) as SocialByIdProjection[],
    };
  } catch (error) {
    console.error("[ERROR] Unexpected error in selectSocialsByIds:", error);
    return {
      status: "error",
      socials: [],
    };
  }
}
