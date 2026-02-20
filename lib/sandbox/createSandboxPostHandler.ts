import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateSandboxBody } from "@/lib/sandbox/validateSandboxBody";
import { processCreateSandbox } from "@/lib/sandbox/processCreateSandbox";

/**
 * Handler for POST /api/sandboxes.
 *
 * Creates a Vercel Sandbox (from account's snapshot if available, otherwise fresh).
 * If a command is provided, triggers the run-sandbox-command task to execute it.
 * If no command is provided, simply creates the sandbox without running any command.
 * Requires authentication via x-api-key header or Authorization Bearer token.
 * Saves sandbox info to the account_sandboxes table.
 *
 * @param request - The request object
 * @returns A NextResponse with sandbox creation result (includes runId only if command was provided)
 */
export async function createSandboxPostHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateSandboxBody(request);
  if (validated instanceof NextResponse) {
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
    const message = error instanceof Error ? error.message : "Failed to create sandbox";
    return NextResponse.json(
      { status: "error", error: message },
      { status: 400, headers: getCorsHeaders() },
    );
  }
}
