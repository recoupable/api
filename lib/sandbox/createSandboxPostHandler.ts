import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createSandbox } from "@/lib/sandbox/createSandbox";
import { validateSandboxBody } from "@/lib/sandbox/validateSandboxBody";
import { insertAccountSandbox } from "@/lib/supabase/account_sandboxes/insertAccountSandbox";
import { triggerRunSandboxCommand } from "@/lib/trigger/triggerRunSandboxCommand";
import { selectAccountSnapshot } from "@/lib/supabase/account_snapshots/selectAccountSnapshot";

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
  console.log("[createSandboxPostHandler] Starting handler");

  console.log("[createSandboxPostHandler] Validating request body");
  const validated = await validateSandboxBody(request);
  if (validated instanceof NextResponse) {
    console.log("[createSandboxPostHandler] Validation failed, returning error response");
    return validated;
  }
  console.log("[createSandboxPostHandler] Validation passed for account:", validated.accountId);

  try {
    // Get account's snapshot if available
    console.log("[createSandboxPostHandler] Fetching account snapshot");
    const accountSnapshot = await selectAccountSnapshot(validated.accountId);
    const snapshotId = accountSnapshot?.snapshot_id;
    console.log("[createSandboxPostHandler] Snapshot ID:", snapshotId ?? "none");

    // Create sandbox (from snapshot if valid, otherwise fresh)
    console.log("[createSandboxPostHandler] Creating sandbox");
    const result = await createSandbox(
      snapshotId ? { source: { type: "snapshot", snapshotId } } : {},
    );
    console.log("[createSandboxPostHandler] Sandbox created:", result.sandboxId);

    console.log("[createSandboxPostHandler] Inserting account sandbox record");
    await insertAccountSandbox({
      account_id: validated.accountId,
      sandbox_id: result.sandboxId,
    });
    console.log("[createSandboxPostHandler] Account sandbox record inserted");

    // Trigger the command execution task
    let runId: string | undefined;
    try {
      console.log("[createSandboxPostHandler] Triggering run-sandbox-command task");
      const handle = await triggerRunSandboxCommand({
        command: validated.command,
        args: validated.args,
        cwd: validated.cwd,
        sandboxId: result.sandboxId,
        accountId: validated.accountId,
      });
      runId = handle.id;
      console.log("[createSandboxPostHandler] Task triggered, runId:", runId);
    } catch (triggerError) {
      console.error("[createSandboxPostHandler] Failed to trigger task:", triggerError);
      // Continue without runId - sandbox was still created
    }

    console.log("[createSandboxPostHandler] Building success response");
    const response = NextResponse.json(
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
    console.log("[createSandboxPostHandler] Returning success response");
    return response;
  } catch (error) {
    console.error("[createSandboxPostHandler] Error caught:", error);
    const message = error instanceof Error ? error.message : "Failed to create sandbox";
    const response = NextResponse.json(
      { status: "error", error: message },
      { status: 400, headers: getCorsHeaders() },
    );
    console.log("[createSandboxPostHandler] Returning error response");
    return response;
  }
}
