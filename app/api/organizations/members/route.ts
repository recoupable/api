import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { addOrgMemberHandler } from "@/lib/organizations/addOrgMemberHandler";
import { removeOrgMemberHandler } from "@/lib/organizations/removeOrgMemberHandler";

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
 * POST /api/organizations/members
 *
 * Adds a member to an organization. This operation is idempotent.
 * The caller must be a member of the organization or a Recoup admin.
 *
 * Body parameters:
 * - organizationId (required): The organization's account ID (UUID)
 * - accountId or email (exactly one): The member to add. An email is
 *   resolved to an account, creating it if it does not exist yet.
 *
 * @param request - The request object containing the body
 * @returns A NextResponse with the membership record ID and member account ID
 */
export async function POST(request: NextRequest) {
  return addOrgMemberHandler(request);
}

/**
 * DELETE /api/organizations/members
 *
 * Removes a member from an organization. This operation is idempotent.
 * The caller must be a member of the organization or a Recoup admin.
 *
 * Query parameters:
 * - organization_id (required): The organization's account ID (UUID)
 * - account_id (required): The member's account ID (UUID)
 *
 * @param request - The request object containing the query parameters
 * @returns A NextResponse with the operation status
 */
export async function DELETE(request: NextRequest) {
  return removeOrgMemberHandler(request);
}
