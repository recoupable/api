import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createSandbox } from "@/lib/sandbox/createSandbox";
import { validateSandboxBody } from "@/lib/sandbox/validateSandboxBody";
import { insertAccountSandbox } from "@/lib/supabase/account_sandboxes/insertAccountSandbox";
import { triggerRunSandboxCommand } from "@/lib/trigger/triggerRunSandboxCommand";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";

/**
 * Handler for POST /api/sandboxes.
 *
 * Creates a Vercel Sandbox (from account's snapshot if available, otherwise fresh)
 * and triggers the run-sandbox-command task to execute the command.
 * Requires authentication via x-api-key header or Authorization Bearer token.
 * Saves sandbox info to the account_sandboxes table.
 *
 * @param request - The request object
 * @returns A NextResponse with sandbox creation result including runId
 */
export async function createSandboxPostHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateSandboxBody(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  try {
    // Get account's most recent snapshot if available
    const accountSnapshots = await selectAccountSnapshots(validated.accountId);
    const snapshotId = accountSnapshots[0]?.snapshot_id;

    // Create sandbox (from snapshot if valid, otherwise fresh)
    const result = await createSandbox(
      snapshotId ? { source: { type: "snapshot", snapshotId } } : {},
    );

    await insertAccountSandbox({
      account_id: validated.accountId,
      sandbox_id: result.sandboxId,
    });

    // Trigger the command execution task
    let runId: string | undefined;
    try {
      const handle = await triggerRunSandboxCommand({
        command: validated.command,
        args: validated.args,
        cwd: validated.cwd,
        sandboxId: result.sandboxId,
        accountId: validated.accountId,
      });
      runId = handle.id;
    } catch (triggerError) {
      console.error("Failed to trigger run-sandbox-command task:", triggerError);
    }

    return NextResponse.json(
      {
        status: "success",
        sandboxes: [
          {
            ...result,
            ...(runId && { runId }),
          },
        ],
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create sandbox";
    return NextResponse.json(
      { status: "error", error: message },
      { status: 400, headers: getCorsHeaders() },
    );
  }
}
