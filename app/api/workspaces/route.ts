import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createWorkspacePostHandler } from "@/lib/workspaces/createWorkspacePostHandler";

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
 * POST /api/workspaces
 *
 * Creates a new workspace account.
 *
 * Request body:
 * - name (optional): The name of the workspace to create. Defaults to "Untitled".
 * - account_id (optional): The ID of the account to create the workspace for (UUID).
 *   Only required for organization API keys creating workspaces on behalf of other accounts.
 * - organization_id (optional): The organization ID to link the new workspace to (UUID).
 *   If provided, the workspace will appear in that organization's view.
 *   Access is validated to ensure the user has access to the organization.
 *
 * Response:
 * - 201: { workspace: WorkspaceObject }
 * - 400: { status: "error", error: "validation error message" }
 * - 401: { status: "error", error: "x-api-key header required" or "Invalid API key" }
 * - 403: { status: "error", error: "Access denied to specified organization_id/account_id" }
 * - 500: { status: "error", error: "Failed to create workspace" }
 *
 * @param request - The request object containing JSON body
 * @returns A NextResponse with the created workspace data (201) or error
 */
export async function POST(request: NextRequest) {
  return createWorkspacePostHandler(request);
}
