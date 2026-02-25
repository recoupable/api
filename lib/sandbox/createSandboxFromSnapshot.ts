import ms from "ms";
import { Sandbox } from "@vercel/sandbox";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";
import { insertAccountSandbox } from "@/lib/supabase/account_sandboxes/insertAccountSandbox";

const DEFAULT_TIMEOUT = ms("30m");
const DEFAULT_VCPUS = 4;
const DEFAULT_RUNTIME = "node22";

/**
 * Creates a new sandbox from the account's latest snapshot (or fresh if none)
 * and records it in the database.
 *
 * @param accountId - The account ID to create a sandbox for
 * @returns The created Sandbox instance
 */
export async function createSandboxFromSnapshot(
  accountId: string,
): Promise<Sandbox> {
  const snapshots = await selectAccountSnapshots(accountId);
  const snapshotId = snapshots[0]?.snapshot_id;

  const sandbox = await Sandbox.create(
    snapshotId
      ? {
          source: { type: "snapshot" as const, snapshotId },
          timeout: DEFAULT_TIMEOUT,
        }
      : {
          resources: { vcpus: DEFAULT_VCPUS },
          timeout: DEFAULT_TIMEOUT,
          runtime: DEFAULT_RUNTIME,
        },
  );

  await insertAccountSandbox({
    account_id: accountId,
    sandbox_id: sandbox.sandboxId,
  });

  return sandbox;
}
