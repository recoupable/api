import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { professionalRosterHandler } from "@/lib/professionals/professionalRosterHandler";

/**
 * List organization-private professionals using a stable ID cursor.
 *
 * @param request - Authenticated query and cursor.
 * @returns Private professional roster page.
 */
export async function GET(request: NextRequest) {
  return professionalRosterHandler(request);
}
/**
 * Confirm a new professional or add roles to an explicitly selected record.
 *
 * @param request - Authenticated confirmation command.
 * @returns Saved professional or scoped error.
 */
export async function POST(request: NextRequest) {
  return professionalRosterHandler(request);
}
/**
 * CORS preflight for the authenticated browser client.
 *
 * @returns Allowed request headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}
