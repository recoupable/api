import { createSandbox, type SandboxCreatedResponse } from "@/lib/sandbox/createSandbox";
import { insertAccountSandbox } from "@/lib/supabase/account_sandboxes/insertAccountSandbox";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";
import { triggerPromptSandbox } from "@/lib/trigger/triggerPromptSandbox";

type ProcessCreateSandboxInput = {
  accountId: string;
  prompt?: string;
};
type ProcessCreateSandboxResult = SandboxCreatedResponse & { runId?: string };

/**
 * Returns a valid (non-expired) snapshot ID for the account, or undefined.
 *
 * @param accountId - The account to look up
 * @returns The snapshot ID if it exists and has not expired
 */
async function getValidSnapshotId(accountId: string): Promise<string | undefined> {
  const accountSnapshots = await selectAccountSnapshots(accountId);
  const snapshot = accountSnapshots[0];
  if (!snapshot?.snapshot_id) return undefined;

  if (snapshot.expires_at && new Date(snapshot.expires_at) < new Date()) {
    return undefined;
  }

  return snapshot.snapshot_id;
}

/**
 * Shared domain logic for creating a sandbox and optionally running a prompt.
 * Used by both POST /api/sandboxes handler and the prompt_sandbox MCP tool.
 *
 * @param input - The sandbox creation parameters
 * @returns The sandbox creation result with optional runId
 */
export async function processCreateSandbox(
  input: ProcessCreateSandboxInput,
): Promise<ProcessCreateSandboxResult> {
  const { accountId, prompt } = input;

  const snapshotId = await getValidSnapshotId(accountId);

  let result;

  if (snapshotId) {
    try {
      const createResult = await createSandbox({
        source: { type: "snapshot", snapshotId },
      });
      result = createResult.response;
    } catch {
      const freshResult = await createSandbox({});
      result = freshResult.response;
    }
  } else {
    const freshResult = await createSandbox({});
    result = freshResult.response;
  }

  await insertAccountSandbox({
    account_id: accountId,
    sandbox_id: result.sandboxId,
  });

  // Trigger the prompt execution task if a prompt was provided
  let runId: string | undefined;
  if (prompt) {
    try {
      const handle = await triggerPromptSandbox({
        prompt,
        sandboxId: result.sandboxId,
        accountId,
      });
      runId = handle.id;
    } catch (triggerError) {
      console.error("Failed to trigger prompt sandbox task:", triggerError);
      runId = undefined;
    }
  }

  return {
    ...result,
    ...(runId && { runId }),
  };
}
