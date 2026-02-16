import { createSandbox, type SandboxCreatedResponse } from "@/lib/sandbox/createSandbox";
import { insertAccountSandbox } from "@/lib/supabase/account_sandboxes/insertAccountSandbox";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";
import { triggerRunSandboxCommand } from "@/lib/trigger/triggerRunSandboxCommand";
import type { SandboxBody } from "@/lib/sandbox/validateSandboxBody";

type ProcessCreateSandboxResult = SandboxCreatedResponse & { runId?: string };

/**
 * Shared domain logic for creating a sandbox and optionally running a command.
 * Used by both POST /api/sandboxes handler and the run_sandbox_command MCP tool.
 *
 * @param input - The sandbox creation parameters
 * @returns The sandbox creation result with optional runId
 */
export async function processCreateSandbox(
  input: SandboxBody,
): Promise<ProcessCreateSandboxResult> {
  const { accountId, command, args, cwd } = input;

  // Get account's most recent snapshot if available
  const accountSnapshots = await selectAccountSnapshots(accountId);
  const snapshotId = accountSnapshots[0]?.snapshot_id;

  // Create sandbox (from snapshot if valid, otherwise fresh)
  const result = await createSandbox(
    snapshotId ? { source: { type: "snapshot", snapshotId } } : {},
  );

  await insertAccountSandbox({
    account_id: accountId,
    sandbox_id: result.sandboxId,
  });

  // Trigger the command execution task if a command was provided
  let runId: string | undefined;
  if (command) {
    try {
      const handle = await triggerRunSandboxCommand({
        command,
        args,
        cwd,
        sandboxId: result.sandboxId,
        accountId,
      });
      runId = handle.id;
    } catch (triggerError) {
      console.error("Failed to trigger run-sandbox-command task:", triggerError);
      runId = undefined;
    }
  }

  return {
    ...result,
    ...(runId && { runId }),
  };
}
