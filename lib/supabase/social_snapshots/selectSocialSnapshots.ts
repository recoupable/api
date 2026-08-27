import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

type SelectSocialSnapshotsParams = {
  socialIds: string[];
  /** Window in days, counted back from now. */
  days: number;
};

/**
 * Follower-count points for a set of socials within the last `days`,
 * newest first. Returns [] for an empty id list without querying.
 */
export async function selectSocialSnapshots({
  socialIds,
  days,
}: SelectSocialSnapshotsParams): Promise<Tables<"social_snapshots">[]> {
  if (socialIds.length === 0) return [];
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("social_snapshots")
    .select("*")
    .in("social_id", socialIds)
    .gte("captured_at", since)
    .order("captured_at", { ascending: false });

  if (error) {
    console.error("[ERROR] selectSocialSnapshots:", error);
    throw error;
  }
  return data ?? [];
}
