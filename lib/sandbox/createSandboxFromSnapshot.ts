import type { Sandbox } from "@vercel/sandbox";
import { createSandbox } from "@/lib/sandbox/createSandbox";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";
import { insertAccountSandbox } from "@/lib/supabase/account_sandboxes/insertAccountSandbox";

export interface CreateSandboxFromSnapshotResult {
  sandbox: Sandbox;
  fromSnapshot: boolean;
}

/**
 * Creates a new sandbox from the account's latest valid snapshot,
 * falling back to a fresh sandbox if the snapshot is expired or fails.
 *
 * @param accountId - The account ID to create a sandbox for
 * @returns The created Sandbox instance and whether it was created from a snapshot
 */
export async function createSandboxFromSnapshot(
  accountId: string,
): Promise<CreateSandboxFromSnapshotResult> {
  const snapshots = await selectAccountSnapshots(accountId);
  const snapshot = snapshots[0];

  const isExpired =
    snapshot?.expires_at && new Date(snapshot.expires_at) < new Date();
  const snapshotId = !isExpired ? snapshot?.snapshot_id : undefined;

  let sandbox: Sandbox;
  let fromSnapshot = false;

  if (snapshotId) {
    try {
      const result = await createSandbox({
        source: { type: "snapshot", snapshotId },
      });
      sandbox = result.sandbox;
      fromSnapshot = true;
    } catch {
      const result = await createSandbox({});
      sandbox = result.sandbox;
    }
  } else {
    const result = await createSandbox({});
    sandbox = result.sandbox;
  }

  await insertAccountSandbox({
    account_id: accountId,
    sandbox_id: sandbox.sandboxId,
  });

  return { sandbox, fromSnapshot };
}
