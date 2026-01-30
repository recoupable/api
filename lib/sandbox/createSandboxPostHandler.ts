import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { createSandbox } from "@/lib/sandbox/createSandbox";
import { validateSandboxBody } from "@/lib/sandbox/validateSandboxBody";

/**
 * Handler for POST /api/sandbox.
 *
 * Creates a Vercel Sandbox with Claude's Agent SDK pre-installed and executes a script.
 * Requires authentication via x-api-key header or Authorization Bearer token.
 *
 * @param request - The request object
 * @returns A NextResponse with sandbox execution result or error
 */
export async function createSandboxPostHandler(request: NextRequest): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid JSON body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const validated = validateSandboxBody(body);
  if (validated instanceof NextResponse) {
    return validated;
  }

  try {
    const result = await createSandbox(validated.script);

    return NextResponse.json(
      {
        status: result.exitCode === 0 ? "success" : "error",
        data: result,
      },
      {
        status: result.exitCode === 0 ? 200 : 500,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to execute sandbox script";
    return NextResponse.json(
      { status: "error", error: message },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
