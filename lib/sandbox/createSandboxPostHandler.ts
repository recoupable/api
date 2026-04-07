import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateSandboxBody } from "@/lib/sandbox/validateSandboxBody";
import { processCreateSandbox } from "@/lib/sandbox/processCreateSandbox";

/**
 * Handler for POST /api/sandboxes.
 *
 * Creates a Vercel Sandbox (from account's snapshot if available, otherwise fresh).
 * If a prompt is provided, triggers a task to run the prompt via OpenClaw.
 * If no prompt is provided, simply creates the sandbox without running anything.
 * Requires authentication via x-api-key header or Authorization Bearer token.
 * Saves sandbox info to the account_sandboxes table.
 *
 * @param request - The request object
 * @returns A NextResponse with sandbox creation result (includes runId only if prompt was provided)
 */
export async function createSandboxPostHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateSandboxBody(request);
  if (validated instanceof NextResponse) {
    const errorBody = await validated.clone().json();
    console.error("[POST /api/sandboxes] Validation/auth failed:", errorBody);
    return validated;
  }

  try {
    const result = await processCreateSandbox(validated);

    return NextResponse.json(
      {
        status: "success",
        sandboxes: [result],
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[POST /api/sandboxes] Error creating sandbox:", error);
    const message = error instanceof Error ? error.message : "Failed to create sandbox";
    return NextResponse.json(
      { status: "error", error: message },
      { status: 400, headers: getCorsHeaders() },
    );
  }
}
