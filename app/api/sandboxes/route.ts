import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createSandboxPostHandler } from "@/lib/sandbox/createSandboxPostHandler";
import { deleteSandboxHandler } from "@/lib/sandbox/deleteSandboxHandler";
import { getSandboxesHandler } from "@/lib/sandbox/getSandboxesHandler";
import { updateSnapshotPatchHandler } from "@/lib/sandbox/updateSnapshotPatchHandler";

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
 * Creates a new ephemeral sandbox environment. Sandboxes are isolated Linux
 * microVMs used to evaluate account-generated code or run AI agent output
 * safely. The sandbox automatically stops after the timeout period.
 *
 * The OpenClaw `prompt` mode (which offloaded to the `run-sandbox-command`
 * task) was retired (recoupable/chat#1813) — async agent work now runs on the
 * durable `runAgentWorkflow` via `POST /api/chat/runs`.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * Request body:
 * - account_id: string (optional, org keys only) - UUID of the account to create for
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

/**
 * GET /api/sandboxes
 *
 * Lists all sandboxes associated with the authenticated account and their current statuses.
 * Returns sandbox details including lifecycle state, timeout remaining, and creation timestamp.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * Query parameters:
 * - sandbox_id: (optional) Filter by a specific sandbox ID. Must be a sandbox
 *   that your account or organization is an admin of.
 *
 * Response (200):
 * - status: "success"
 * - sandboxes: [{ sandboxId, sandboxStatus, timeout, createdAt }]
 *
 * Error (401):
 * - status: "error"
 * - error: string
 *
 * @param request - The request object
 * @returns A NextResponse with sandbox statuses
 */
export async function GET(request: NextRequest): Promise<Response> {
  return getSandboxesHandler(request);
}

/**
 * PATCH /api/sandboxes
 *
 * Updates the snapshot ID for an account. This snapshot will be used
 * as the base environment when creating new sandboxes.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * Request body:
 * - snapshotId: string (required) - The snapshot ID to set for the account
 *
 * Response (200):
 * - success: boolean
 * - snapshotId: string - The snapshot ID that was set
 *
 * Error (400/401):
 * - status: "error"
 * - error: string
 *
 * @param request - The request object
 * @returns A NextResponse with the updated snapshot ID or error
 */
export async function PATCH(request: NextRequest): Promise<Response> {
  return updateSnapshotPatchHandler(request);
}

/**
 * DELETE /api/sandboxes
 *
 * Deletes the GitHub repository and snapshot record for an account.
 * For personal API keys, deletes the sandbox for the key owner's account.
 * Organization API keys may specify account_id to target any account
 * within their organization.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * Request body:
 * - account_id: string (optional) - UUID of the account to delete for (org keys only)
 *
 * Response (200):
 * - status: "success"
 * - deleted_snapshot: { account_id, snapshot_id, expires_at, github_repo, created_at } | null
 *
 * Error (400/401/403/500):
 * - status: "error"
 * - error: string
 *
 * @param request - The request object
 * @returns A NextResponse with the deletion result or error
 */
export async function DELETE(request: NextRequest): Promise<Response> {
  return deleteSandboxHandler(request);
}
