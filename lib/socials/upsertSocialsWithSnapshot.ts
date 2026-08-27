import { upsertSocials } from "@/lib/supabase/socials/upsertSocials";
import {
  upsertSocialSnapshots,
  type SocialSnapshotInsert,
} from "@/lib/supabase/social_snapshots/upsertSocialSnapshots";
import type { Tables, TablesInsert } from "@/types/database.types";

/** A socials upsert row plus the one field only the snapshot keeps. */
export type SocialUpsertWithSnapshot = TablesInsert<"socials"> & {
  /** Lifetime post count where the platform reports it; snapshot-only. */
  postCount?: number | null;
};

/**
 * The one socials write path every scrape handler uses (app#2018): upserts
 * the `socials` rows, then appends a `social_snapshots` point for each row
 * that carries a follower count, so follower history accrues from the first
 * scrape onward without any handler knowing about snapshots.
 *
 * Snapshot rows are matched to socials by `profile_url`, never by array
 * position — the upsert's return order is not guaranteed.
 *
 * @param socials - Rows to upsert; `postCount` goes to the snapshot only.
 * @returns The upserted `socials` rows.
 */
export async function upsertSocialsWithSnapshot(
  socials: SocialUpsertWithSnapshot[],
): Promise<Tables<"socials">[]> {
  if (socials.length === 0) return [];

  const rows = socials.map(({ postCount: _postCount, ...row }) => row);
  const upserted = await upsertSocials(rows);

  const idByUrl = new Map(upserted.map(s => [s.profile_url, s.id]));
  const snapshots: SocialSnapshotInsert[] = [];
  for (const social of socials) {
    const socialId = idByUrl.get(social.profile_url);
    if (socialId === undefined || social.followerCount == null) continue;
    snapshots.push({
      social_id: socialId,
      follower_count: social.followerCount,
      following_count: social.followingCount ?? null,
      post_count: social.postCount ?? null,
    });
  }
  if (snapshots.length > 0) await upsertSocialSnapshots(snapshots);

  return upserted;
}
