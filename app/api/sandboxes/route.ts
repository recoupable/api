import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createSandboxPostHandler } from "@/lib/sandbox/createSandboxPostHandler";
import { getSandboxesHandler } from "@/lib/sandbox/getSandboxesHandler";

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
 * Creates a new ephemeral sandbox environment and executes a command.
 * Sandboxes are isolated Linux microVMs that can be used to evaluate
 * account-generated code, run AI agent output safely, or execute reproducible tasks.
 * The sandbox will automatically stop after the timeout period.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * Request body:
 * - command: string (required) - The command to execute in the sandbox
 * - args: string[] (optional) - Arguments to pass to the command
 * - cwd: string (optional) - Working directory for command execution
 *
 * Response (200):
 * - status: "success"
 * - sandboxes: [{ sandboxId, sandboxStatus, timeout, createdAt, runId }]
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
