import { createSandbox, type SandboxCreatedResponse } from "@/lib/sandbox/createSandbox";
import { getValidSnapshotId } from "@/lib/sandbox/getValidSnapshotId";
import { insertAccountSandbox } from "@/lib/supabase/account_sandboxes/insertAccountSandbox";
import { triggerPromptSandbox } from "@/lib/trigger/triggerPromptSandbox";

type ProcessCreateSandboxInput = {
  accountId: string;
  prompt?: string;
};
type ProcessCreateSandboxResult = SandboxCreatedResponse & { runId?: string };

/**
 * Attempts to create a sandbox from the given snapshot, falling back to a fresh sandbox on failure.
 * If no snapshotId is provided, creates a fresh sandbox directly.
 *
 * @param snapshotId - Optional snapshot ID to restore from
 * @returns The sandbox creation response
 */
async function createSandboxWithFallback(snapshotId: string | undefined) {
  if (snapshotId) {
    try {
      return (await createSandbox({ source: { type: "snapshot", snapshotId } })).response;
    } catch {
      // Snapshot invalid or expired on Vercel's side — fall through to fresh
    }
  }
  return (await createSandbox({})).response;
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
  const result = await createSandboxWithFallback(snapshotId);

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
