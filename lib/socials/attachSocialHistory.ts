import { selectSocialSnapshots } from "@/lib/supabase/social_snapshots/selectSocialSnapshots";
import type { AccountSocialResponse } from "@/lib/account/flattenAccountSocials";

/** One follower-history point as `GET /api/artists/{id}/socials?history=` returns it. */
export type SocialHistoryPoint = {
  captured_at: string;
  follower_count: number;
  following_count: number | null;
  post_count: number | null;
};

/**
 * Attaches `history` (snapshot points for the last `days`, newest first)
 * to each social of a page. A social with no points gets `[]`, so callers
 * can always index the array.
 *
 * @param socials - The page of flattened socials.
 * @param days - Window in days.
 */
export async function attachSocialHistory(
  socials: AccountSocialResponse[],
  days: number,
): Promise<(AccountSocialResponse & { history: SocialHistoryPoint[] })[]> {
  const snapshots = await selectSocialSnapshots({
    socialIds: socials.map(s => s.social_id),
    days,
  });
  const byId = new Map<string, SocialHistoryPoint[]>();
  for (const s of snapshots) {
    const list = byId.get(s.social_id) ?? [];
    list.push({
      captured_at: s.captured_at,
      follower_count: s.follower_count,
      following_count: s.following_count,
      post_count: s.post_count,
    });
    byId.set(s.social_id, list);
  }
  return socials.map(s => ({ ...s, history: byId.get(s.social_id) ?? [] }));
}
