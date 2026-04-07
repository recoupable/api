import type { Sandbox } from "@vercel/sandbox";
import { createSandbox } from "@/lib/sandbox/createSandbox";
import { getValidSnapshotId } from "@/lib/sandbox/getValidSnapshotId";
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
  const snapshotId = await getValidSnapshotId(accountId);

  let sandbox: Sandbox;
  let fromSnapshot = false;

  if (snapshotId) {
    try {
      sandbox = (await createSandbox({ source: { type: "snapshot", snapshotId } })).sandbox;
      fromSnapshot = true;
    } catch {
      // Snapshot invalid or expired on Vercel's side — fall through to fresh
    }
  }

  if (!fromSnapshot) {
    sandbox = (await createSandbox({})).sandbox;
  }

  await insertAccountSandbox({
    account_id: accountId,
    sandbox_id: sandbox.sandboxId,
  });

  return { sandbox, fromSnapshot };
}
