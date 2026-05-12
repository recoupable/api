import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { listTemplatesHandler } from "@/lib/templates/listTemplatesHandler";
import { createTemplateHandler } from "@/lib/templates/createTemplateHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 200 NextResponse carrying the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * GET /api/templates
 *
 * Returns every template visible to the authenticated account (own,
 * public, and shared) with an embedded creator block (id/name/image/is_admin),
 * the caller's `is_favourite` flag, and `shared_emails` for private templates.
 *
 * @param request - Incoming request; auth is read from headers.
 * @returns A 200 NextResponse with `{ status, templates }`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return listTemplatesHandler(request);
}

/**
 * POST /api/templates
 *
 * Creates a new template owned by the authenticated account. When
 * `is_private=true`, `share_emails` recipients are upserted into the shares
 * table.
 *
 * @param request - Incoming request; body is JSON-encoded.
 * @returns A 201 NextResponse with `{ status, template }` on success.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return createTemplateHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
