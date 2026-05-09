import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { updateAgentTemplateHandler } from "@/lib/agent_templates/updateAgentTemplateHandler";
import { deleteAgentTemplateHandler } from "@/lib/agent_templates/deleteAgentTemplateHandler";

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
 * PATCH /api/agent-templates/{id}
 *
 * Updates one or more fields on an agent template the authenticated account
 * owns. Supplying `share_emails` replaces existing shares.
 *
 * @param request - Incoming request; body is JSON-encoded.
 * @param context - Route context.
 * @param context.params - Promise resolving to `{ id }`, the template UUID.
 * @returns A 200 NextResponse with `{ status, template }` on success.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return updateAgentTemplateHandler(request, context.params);
}

/**
 * DELETE /api/agent-templates/{id}
 *
 * Permanently removes an agent template the authenticated account owns.
 *
 * @param request - Incoming request; auth is read from headers.
 * @param context - Route context.
 * @param context.params - Promise resolving to `{ id }`, the template UUID.
 * @returns A 200 NextResponse with `{ status: "success" }` on success.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return deleteAgentTemplateHandler(request, context.params);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
