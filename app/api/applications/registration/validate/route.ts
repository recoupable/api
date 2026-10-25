import { NextRequest } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateApplicationRegistrationHandler } from "@/lib/applications/validateApplicationRegistrationHandler";
/**
 * Validate an application registration proposal in the authenticated workspace. Does not create it.
 *
 * @param request - Authenticated request containing the proposed addresses.
 * @returns The validated proposal or a sanitized error response.
 */
export async function POST(request: NextRequest) {
  return validateApplicationRegistrationHandler(request);
}
/**
 * Browser preflight for the authenticated registration validation endpoint.
 *
 * @returns CORS preflight response.
 */
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
