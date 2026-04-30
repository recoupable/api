import { upsertSocials } from "@/lib/supabase/socials/upsertSocials";
import type { Tables, TablesInsert } from "@/types/database.types";
import type { ApifyInstagramComment } from "@/lib/apify/types";

/**
 * Ensures a `socials` row exists for each distinct comment author and
 * returns a map from `username` to the upserted social row. Upstream
 * `upsertSocials` upserts on `profile_url`, so repeated calls are
 * idempotent even when the same commenter recurs across posts.
 *
 * @param comments - Apify Instagram comment dataset items.
 */
export async function getOrCreateSocialsForComments(
  comments: ApifyInstagramComment[],
): Promise<Map<string, Tables<"socials">>> {
  const seen = new Set<string>();
  const rows: TablesInsert<"socials">[] = [];
  for (const c of comments) {
    if (!c.ownerUsername || seen.has(c.ownerUsername)) continue;
    seen.add(c.ownerUsername);
    rows.push({
      username: c.ownerUsername,
      profile_url: `instagram.com/${c.ownerUsername}`,
      avatar: c.ownerProfilePicUrl,
    });
  }

  const upserted = await upsertSocials(rows);
  return new Map(upserted.map(s => [s.username, s]));
}
