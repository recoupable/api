import { getActiveSandbox } from "./getActiveSandbox";
import {
  createSandboxFromSnapshot,
  type CreateSandboxFromSnapshotResult,
} from "./createSandboxFromSnapshot";

export interface GetOrCreateSandboxResult extends CreateSandboxFromSnapshotResult {
  sandboxId: string;
  created: boolean;
}

/**
 * Returns an active sandbox for the account, creating one if none exists.
 *
 * @param accountId - The account ID to get or create a sandbox for
 * @returns The sandbox instance, its ID, whether it was newly created, and whether it was from a snapshot
 */
export async function getOrCreateSandbox(accountId: string): Promise<GetOrCreateSandboxResult> {
  const existing = await getActiveSandbox(accountId);

  if (existing) {
    return {
      sandbox: existing,
      sandboxId: existing.sandboxId,
      created: false,
      fromSnapshot: true,
    };
  }

  const { sandbox, fromSnapshot } = await createSandboxFromSnapshot(accountId);

  return {
    sandbox,
    sandboxId: sandbox.sandboxId,
    created: true,
    fromSnapshot,
  };
}
