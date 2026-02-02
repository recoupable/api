import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
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
 * POST /api/sandboxes
 *
 * Creates a new ephemeral sandbox environment.
 * Sandboxes are isolated Linux microVMs that can be used to evaluate
 * account-generated code, run AI agent output safely, or execute reproducible tasks.
 * The sandbox will automatically stop after the timeout period.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * Request body:
 * - prompt: string (required, min length 1) - The prompt to send to Claude Code
 *
 * Response (200):
 * - status: "success"
 * - sandboxes: [{ sandboxId, sandboxStatus, timeout, createdAt }]
 *
 * Error (400/401):
 * - status: "error"
 * - error: string
 *
 * @param request - The request object
 * @returns A NextResponse with the sandbox creation result or error
 */
export async function POST(request: NextRequest): Promise<Response> {
  return createSandboxPostHandler(request);
}
