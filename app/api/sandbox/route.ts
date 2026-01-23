import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createSandboxPostHandler } from "@/lib/sandbox/createSandboxPostHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * POST /api/sandbox
 *
 * Creates a new ephemeral sandbox environment.
 * Sandboxes are isolated Linux microVMs that can be used to evaluate
 * account-generated code, run AI agent output safely, or execute reproducible tasks.
 *
 * Request:
 * - No request body required
 * - Authentication via x-api-key header
 *
 * Response:
 * - 200: { sandboxId: string, status: string, timeout: number, createdAt: string }
 * - 400: { error: "Failed to create sandbox" }
 * - 401: { status: "error", error: "x-api-key header required" or "Invalid API key" }
 *
 * @param request - The request object
 * @returns A NextResponse with the created sandbox data or error
 */
export async function POST(request: NextRequest) {
  return createSandboxPostHandler(request);
}
