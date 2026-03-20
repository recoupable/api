import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getOrganizationsHandler } from "@/lib/organizations/getOrganizationsHandler";
import { createOrganizationHandler } from "@/lib/organizations/createOrganizationHandler";

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
 * GET /api/organizations
 *
 * Retrieves all organizations an account belongs to.
 * Requires authentication via x-api-key or Authorization bearer token.
 *
 * For personal keys: returns the key owner's organizations.
 * For org keys: returns organizations for all accounts in the org.
 * For Recoup admin: returns all organizations.
 *
 * Query parameters:
 * - account_id (optional): Filter to a specific account (org keys only)
 *
 * @param request - The request object
 * @returns A NextResponse with organizations data
 */
export async function GET(request: NextRequest) {
  return getOrganizationsHandler(request);
}

/**
 * POST /api/organizations
 *
 * Creates a new organization and adds the creator as a member.
 *
 * Body parameters:
 * - name (required): The name of the organization
 * - accountId (required): The account ID of the creator (UUID)
 *
 * @param request - The request object containing the body
 * @returns A NextResponse with the created organization
 */
export async function POST(request: NextRequest) {
  return createOrganizationHandler(request);
}
