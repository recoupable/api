import type { Sandbox } from "@vercel/sandbox";
import { createSandbox } from "@/lib/sandbox/createSandbox";
import { insertAccountSandbox } from "@/lib/supabase/account_sandboxes/insertAccountSandbox";

export interface CreateSandboxFromSnapshotResult {
  sandbox: Sandbox;
  fromSnapshot: boolean;
}

/**
 * Creates a new sandbox for an account using name-based persistence
 * and records it in the database.
 *
 * Uses the Vercel Sandbox names feature with accountId as the name,
 * replacing the previous snapshotId-based approach.
 *
 * @param accountId - The account ID to create a sandbox for
 * @returns The created Sandbox instance (fromSnapshot is always false with name-based approach)
 */
export async function createSandboxFromSnapshot(
  accountId: string,
): Promise<CreateSandboxFromSnapshotResult> {
  const { sandbox, response } = await createSandbox({ name: accountId });

  await insertAccountSandbox({
    account_id: accountId,
    sandbox_id: response.sandboxId,
  });

  return { sandbox, fromSnapshot: false };
}
