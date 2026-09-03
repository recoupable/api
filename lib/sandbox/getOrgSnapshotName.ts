import { DEFAULT_SANDBOX_BASE_SNAPSHOT_ID } from "@/lib/sandbox/defaultBaseSnapshotId";

/**
 * The name an org's warm-boot snapshot is stored and looked up under.
 *
 * Org snapshots are built from the base snapshot and matched by name alone,
 * with a 30-day expiry. Putting the base id in the name makes a new base an
 * automatic miss: the next session cold-starts, rebuilds on the new base, and
 * the old snapshot simply expires (recoupable/app#2052, ffmpeg in the base).
 *
 * @param orgRepoName - The org repo name from `extractOrgRepoName`.
 * @param baseSnapshotId - The base the snapshot is built from.
 * @returns A sandbox/snapshot name, lowercase and dash-separated.
 */
export function getOrgSnapshotName(
  orgRepoName: string,
  baseSnapshotId: string = DEFAULT_SANDBOX_BASE_SNAPSHOT_ID,
): string {
  const tail = baseSnapshotId
    .replace(/^snap_/, "")
    .slice(-8)
    .toLowerCase();
  return `${orgRepoName}-${tail}`;
}
