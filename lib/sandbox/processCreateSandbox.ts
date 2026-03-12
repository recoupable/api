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

  // Get account's most recent snapshot if available
  const accountSnapshots = await selectAccountSnapshots(accountId);
  const snapshotId = accountSnapshots[0]?.snapshot_id;

  // Create sandbox (from snapshot if valid, otherwise fresh)
  const { response: result } = await createSandbox(
    snapshotId ? { source: { type: "snapshot", snapshotId } } : {},
  );

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
