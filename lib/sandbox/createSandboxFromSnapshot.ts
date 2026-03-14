import type { Sandbox } from "@vercel/sandbox";
import { createSandbox } from "@/lib/sandbox/createSandbox";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";
import { insertAccountSandbox } from "@/lib/supabase/account_sandboxes/insertAccountSandbox";

export interface CreateSandboxFromSnapshotResult {
  sandbox: Sandbox;
  fromSnapshot: boolean;
}

/**
 * Creates a new sandbox from the account's latest snapshot (or fresh if none)
 * and records it in the database.
 *
 * @param accountId - The account ID to create a sandbox for
 * @returns The created Sandbox instance and whether it was created from a snapshot
 */
export async function createSandboxFromSnapshot(
  accountId: string,
): Promise<CreateSandboxFromSnapshotResult> {
  const snapshots = await selectAccountSnapshots(accountId);
  const snapshotId = snapshots[0]?.snapshot_id;

  const { sandbox, response } = await createSandbox(
    snapshotId ? { source: { type: "snapshot", snapshotId } } : {},
  );

  await insertAccountSandbox({
    account_id: accountId,
    sandbox_id: response.sandboxId,
  });

  return { sandbox, fromSnapshot: !!snapshotId };
}
