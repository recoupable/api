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
 * Sets up the sandbox for the key owner's account.
 * Accounts with shared org membership may specify account_id to target another account.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * Request body:
 * - account_id: string (optional) - UUID of the account to set up for (requires shared org membership or admin access)
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
