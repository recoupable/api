import { insertSocials } from "@/lib/supabase/socials/insertSocials";
import type { Tables, TablesInsert } from "@/types/database.types";
import type { ApifyInstagramComment } from "@/lib/apify/types";

/**
 * Ensures a `socials` row exists for each distinct comment author and
 * returns a map from `username` to the upserted social row. Upstream
 * `insertSocials` upserts on `profile_url`, so repeated calls are
 * idempotent even when the same commenter recurs across posts.
 *
 * @param comments - Apify Instagram comment dataset items.
 */
export async function getOrCreateSocialsForComments(
  comments: ApifyInstagramComment[],
): Promise<Map<string, Tables<"socials">>> {
  const uniqueAuthors = Array.from(
    new Map(
      comments.map(c => [
        c.ownerUsername,
        {
          username: c.ownerUsername,
          profilePicUrl: c.ownerProfilePicUrl,
          profileUrl: `instagram.com/${c.ownerUsername}`,
        },
      ]),
    ).values(),
  );

  const rows: TablesInsert<"socials">[] = uniqueAuthors
    .filter(a => a.username && a.profileUrl)
    .map(a => ({
      username: a.username,
      profile_url: a.profileUrl,
      avatar: a.profilePicUrl,
      bio: null,
      region: null,
      followerCount: null,
      followingCount: null,
    }));

  const upserted = await insertSocials(rows);
  const map = new Map<string, Tables<"socials">>();
  upserted.forEach(social => {
    map.set(social.username, social);
  });
  return map;
}
