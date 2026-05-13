import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSessionByIdHandler } from "@/lib/sessions/getSessionByIdHandler";
import { patchSessionByIdHandler } from "@/lib/sessions/patchSessionByIdHandler";

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
 * GET /api/sessions/{sessionId}
 *
 * Reads a single agent session by id. Authenticates via Privy Bearer
 * token or x-api-key header. Returns 404 if the session does not exist
 * and 403 if it exists but is not owned by the authenticated account.
 *
 * Response shape mirrors open-agents' /api/sessions/[sessionId] so the
 * existing frontend can cut over to api without code changes.
 *
 * @param request - The request object
 * @param options - Route options containing the async params
 * @param options.params - Route params containing the session id
 * @returns A NextResponse with `{ session }` on 200, or an error.
 */
export async function GET(
  request: NextRequest,
  options: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await options.params;
  return getSessionByIdHandler(request, sessionId);
}

/**
 * PATCH /api/sessions/{sessionId}
 *
 * Updates a session's title, lifecycle `status` (including archive /
 * unarchive), and optional line counters. `status` matches the merged
 * docs: `running`, `completed`, `failed`, or `archived`. All body fields
 * are optional; omitted fields are left unchanged.
 * Authenticates via Privy Bearer token or x-api-key header.
 *
 * @param request - The request object
 * @param options - Route options containing the async params
 * @param options.params - Route params containing the session id
 * @returns A NextResponse with `{ session }` on 200, or an error.
 */
export async function PATCH(
  request: NextRequest,
  options: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await options.params;
  return patchSessionByIdHandler(request, sessionId);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
