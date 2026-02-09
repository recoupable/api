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
 * Creates a new ephemeral sandbox environment. Optionally executes a command.
 * Sandboxes are isolated Linux microVMs that can be used to evaluate
 * account-generated code, run AI agent output safely, or execute reproducible tasks.
 * The sandbox will automatically stop after the timeout period.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * Request body:
 * - command: string (optional) - The command to execute in the sandbox. If omitted, sandbox is created without running any command.
 * - args: string[] (optional) - Arguments to pass to the command
 * - cwd: string (optional) - Working directory for command execution
 *
 * Response (200):
 * - status: "success"
 * - sandboxes: [{ sandboxId, sandboxStatus, timeout, createdAt, runId? }]
 *   - runId is only included when a command was provided
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
