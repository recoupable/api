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
 *
 * Query parameters:
 * - accountId (required): The account's ID (UUID)
 *
 * @param request - The request object containing query parameters
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

