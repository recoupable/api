import { Snapshot } from "@vercel/sandbox";

/**
 * Looks up the most recent ready snapshot whose source sandbox name
 * matches `sandboxName`. Used by `POST /api/sandbox` to warm-boot
 * recoupable org sessions from a per-org base snapshot when one
 * exists, instead of paying the full-clone cold-start path.
 *
 * Returns the snapshot id, or `null` when no `created` snapshot
 * exists yet or when the upstream call throws — callers always have
 * a safe fallback to default sandbox provisioning.
 *
 * @param sandboxName - The org repo name returned by `extractOrgRepoName`.
 * @returns The snapshot id, or null on miss / error.
 */
export async function findOrgSnapshot(sandboxName: string): Promise<string | null> {
  try {
    const result = await Snapshot.list({
      name: sandboxName,
      sortOrder: "desc",
      limit: 5,
    });
    const ready = result.snapshots.find(s => s.status === "created");
    console.log(
      `[findOrgSnapshot] '${sandboxName}' → ${ready ? `hit ${ready.id}` : "miss"} (${result.snapshots.length} total snapshots returned)`,
    );
    return ready?.id ?? null;
  } catch (error) {
    console.error(`[findOrgSnapshot] failed to list snapshots for '${sandboxName}':`, error);
    return null;
  }
}
