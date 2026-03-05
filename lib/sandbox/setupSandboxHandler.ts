import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateSetupSandboxBody } from "@/lib/sandbox/validateSetupSandboxBody";
import { triggerSetupSandbox } from "@/lib/trigger/triggerSetupSandbox";
import { isSandboxProvisioned } from "@/lib/sandbox/isSandboxProvisioned";

/**
 * Handler for POST /api/sandboxes/setup.
 *
 * Triggers the setup-sandbox background task to create a personal sandbox,
 * provision a GitHub repo, take a snapshot, and shut down.
 * Idempotent: returns early if the account already has a valid snapshot and GitHub repo.
 * Requires authentication via x-api-key header or Authorization Bearer token.
 *
 * @param request - The request object
 * @returns A NextResponse with the trigger result or error
 */
export async function setupSandboxHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateSetupSandboxBody(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const provisioned = await isSandboxProvisioned(validated.accountId);
  if (provisioned) {
    return NextResponse.json(
      { status: "success", message: "already provisioned" },
      { status: 200, headers: getCorsHeaders() },
    );
  }

  try {
    const handle = await triggerSetupSandbox(validated.accountId);

    return NextResponse.json(
      { status: "success", runId: handle.id },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to trigger setup-sandbox";
    return NextResponse.json(
      { status: "error", error: message },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
