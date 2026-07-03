import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getOrgDomainsHandler } from "@/lib/organizations/getOrgDomainsHandler";
import { addOrgDomainHandler } from "@/lib/organizations/addOrgDomainHandler";
import { removeOrgDomainHandler } from "@/lib/organizations/removeOrgDomainHandler";

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
 * GET /api/organizations/domains
 *
 * Lists the email domains mapped to an organization. Accounts that sign up
 * with an email at a mapped domain automatically join the organization.
 * The caller must be a member of the organization or a Recoup admin.
 *
 * Query parameters:
 * - organization_id (required): The organization's account ID (UUID)
 *
 * @param request - The request object
 * @returns A NextResponse with the organization's domain mappings
 */
export async function GET(request: NextRequest) {
  return getOrgDomainsHandler(request);
}

/**
 * POST /api/organizations/domains
 *
 * Maps an email domain to an organization for automatic membership.
 * Idempotent for the same organization; returns 409 when the domain is
 * already mapped to a different organization.
 *
 * Body parameters:
 * - organizationId (required): The organization's account ID (UUID)
 * - domain (required): The email domain to map (e.g. "seekermusic.com")
 *
 * @param request - The request object containing the body
 * @returns A NextResponse with the domain mapping
 */
export async function POST(request: NextRequest) {
  return addOrgDomainHandler(request);
}

/**
 * DELETE /api/organizations/domains
 *
 * Removes an email domain mapping from an organization. Idempotent.
 *
 * Query parameters:
 * - organization_id (required): The organization's account ID (UUID)
 * - domain (required): The email domain to unmap (e.g. "seekermusic.com")
 *
 * @param request - The request object
 * @returns A NextResponse indicating success
 */
export async function DELETE(request: NextRequest) {
  return removeOrgDomainHandler(request);
}
