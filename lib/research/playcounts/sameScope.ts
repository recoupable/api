import type { Tables } from "@/types/database.types";

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join(" ") === [...b].sort().join(" ");

/**
 * Whether a snapshot row asks the same question as a request: same album set
 * (order-insensitive), same platforms, same schedule.
 *
 * Shared by the reuse pre-check and the post-insert race reconcile so both
 * agree on what "identical" means (chat#1912 rows 4 and 7).
 */
export function sameScope(
  row: Tables<"playcount_snapshots">,
  albumIds: string[],
  platforms: string[],
  schedule: string,
): boolean {
  if (row.schedule !== schedule) return false;
  if (!sameSet(row.album_ids ?? [], albumIds)) return false;
  return sameSet(row.platforms ?? [], platforms);
}
