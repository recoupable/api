import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { setupSandboxHandler } from "@/lib/sandbox/setupSandboxHandler";

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
 * POST /api/sandboxes/setup
 *
 * Triggers the setup-sandbox background task to create a personal sandbox,
 * provision a GitHub repo, take a snapshot, and shut down.
 * For personal API keys, sets up the sandbox for the key owner's account.
 * Organization API keys may specify account_id to target any account
 * within their organization.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * Request body:
 * - account_id: string (optional) - UUID of the account to set up for (org keys only)
 *
 * Response (200):
 * - status: "success"
 * - runId: string - The Trigger.dev run ID for the background task
 *
 * Error (400/401/500):
 * - status: "error"
 * - error: string
 *
 * @param request - The request object
 * @returns A NextResponse with the setup result or error
 */
export async function POST(request: NextRequest): Promise<Response> {
  return setupSandboxHandler(request);
}
