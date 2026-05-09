import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { listAgentTemplatesHandler } from "@/lib/agent_templates/listAgentTemplatesHandler";
import { createAgentTemplateHandler } from "@/lib/agent_templates/createAgentTemplateHandler";

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
 * GET /api/agent-templates
 *
 * Returns every agent template visible to the authenticated account (own,
 * public, and shared) with an embedded creator block (id/name/image/is_admin),
 * the caller's `is_favourite` flag, and `shared_emails` for private templates.
 *
 * @param request - Incoming request; auth is read from headers.
 * @returns A 200 NextResponse with `{ status, templates }`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return listAgentTemplatesHandler(request);
}

/**
 * POST /api/agent-templates
 *
 * Creates a new agent template owned by the authenticated account. When
 * `is_private=true`, `share_emails` recipients are upserted into the shares
 * table.
 *
 * @param request - Incoming request; body is JSON-encoded.
 * @returns A 201 NextResponse with `{ status, template }` on success.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return createAgentTemplateHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
