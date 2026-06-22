import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";

/**
 * Checks if an account has a fully provisioned sandbox (valid snapshot + GitHub repo).
 *
 * @param accountId - The account ID to check
 * @returns true if the account has a non-expired snapshot and a GitHub repo
 */
export async function isSandboxProvisioned(accountId: string): Promise<boolean> {
  const snapshots = await selectAccountSnapshots(accountId);
  const snapshot = snapshots[0];

  if (!snapshot) {
    return false;
  }

  if (!snapshot.snapshot_id || !snapshot.github_repo) {
    return false;
  }

  if (!snapshot.expires_at) {
    return false;
  }

  return new Date(snapshot.expires_at) > new Date();
}
