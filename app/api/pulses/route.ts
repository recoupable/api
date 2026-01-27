import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getPulsesHandler } from "@/lib/pulse/getPulsesHandler";
import { updatePulsesHandler } from "@/lib/pulse/updatePulsesHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}

/**
 * GET /api/pulses
 *
 * Retrieves pulse statuses for accounts.
 * Requires authentication via x-api-key header or Authorization bearer token.
 *
 * For personal keys: Returns array with single pulse for the account.
 * For org keys: Returns array of pulses for all accounts in the organization.
 * For Recoup admin key: Returns array of ALL pulse records.
 *
 * Query parameters:
 * - account_id: For org API keys, filter to a specific account within the organization
 * - active: Filter by active status (true/false). If undefined, returns all.
 *
 * @param request - The request object.
 * @returns A NextResponse with array of pulse statuses.
 */
export async function GET(request: NextRequest) {
  return getPulsesHandler(request);
}

/**
 * PATCH /api/pulses
 *
 * Updates the pulse status for an account.
 * Creates a new pulse_accounts record if one doesn't exist.
 * Requires authentication via x-api-key header or Authorization bearer token.
 *
 * Returns an array of pulses for consistency with the GET endpoint.
 *
 * Body parameters:
 * - active (required): boolean - Whether pulse is active for this account
 * - account_id (optional): For org API keys, target a specific account within the organization
 *
 * @param request - The request object containing the body with active boolean.
 * @returns A NextResponse with array of pulse statuses.
 */
export async function PATCH(request: NextRequest) {
  return updatePulsesHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
