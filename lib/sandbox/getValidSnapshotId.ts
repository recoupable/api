import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";

/**
 * Returns a valid (non-expired) snapshot ID for the account, or undefined.
 *
 * @param accountId - The account to look up
 * @returns The snapshot ID if it exists and has not expired
 */
export async function getValidSnapshotId(accountId: string): Promise<string | undefined> {
  const accountSnapshots = await selectAccountSnapshots(accountId);
  const snapshot = accountSnapshots[0];
  if (!snapshot?.snapshot_id) return undefined;

  if (snapshot.expires_at && new Date(snapshot.expires_at) < new Date()) {
    return undefined;
  }

  return snapshot.snapshot_id;
}
