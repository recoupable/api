import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCreateWorkspaceBody } from "@/lib/workspaces/validateCreateWorkspaceBody";
import { createWorkspaceInDb } from "@/lib/workspaces/createWorkspaceInDb";

/**
 * Handler for POST /api/workspaces.
 *
 * Creates a new workspace account. Requires authentication via x-api-key header.
 * The account ID is inferred from the API key, unless an account_id is provided
 * in the request body by an organization API key with access to that account.
 *
 * Request body:
 * - name (optional): The name of the workspace to create. Defaults to "Untitled".
 * - account_id (optional): The ID of the account to create the workspace for (UUID).
 *   Only used by organization API keys creating workspaces on behalf of other accounts.
 * - organization_id (optional): The organization ID to link the new workspace to (UUID).
 *   If provided, the workspace will appear in that organization's view.
 *
 * @param request - The request object containing JSON body
 * @returns A NextResponse with workspace data or error
 */
export async function createWorkspacePostHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateCreateWorkspaceBody(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  try {
    const workspace = await createWorkspaceInDb(
      validated.name,
      validated.accountId,
      validated.organizationId,
    );

    if (!workspace) {
      return NextResponse.json(
        { status: "error", error: "Failed to create workspace" },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json({ workspace }, { status: 201, headers: getCorsHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create workspace";
    return NextResponse.json(
      { status: "error", error: message },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
