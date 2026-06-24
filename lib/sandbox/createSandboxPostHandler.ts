import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateSandboxBody } from "@/lib/sandbox/validateSandboxBody";
import { processCreateSandbox } from "@/lib/sandbox/processCreateSandbox";

/**
 * Handler for POST /api/sandboxes.
 *
 * Creates a Vercel Sandbox (from account's snapshot if available, otherwise fresh).
 * Requires authentication via x-api-key header or Authorization Bearer token.
 * Saves sandbox info to the account_sandboxes table.
 *
 * The OpenClaw `prompt` mode was retired (recoupable/chat#1813) — async agent
 * work now runs on the durable `runAgentWorkflow` via `POST /api/chat/generate`.
 *
 * @param request - The request object
 * @returns A NextResponse with the sandbox creation result
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
