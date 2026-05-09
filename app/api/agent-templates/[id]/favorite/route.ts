import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { toggleAgentTemplateFavoriteHandler } from "@/lib/agent_templates/toggleAgentTemplateFavoriteHandler";

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
 * PUT /api/agent-templates/{id}/favorite
 *
 * Idempotently sets whether the authenticated account has favorited the
 * template: `{ is_favourite: true }` upserts a row, `false` deletes it.
 *
 * @param request - Incoming request; body is JSON-encoded.
 * @param context - Route context.
 * @param context.params - Promise resolving to `{ id }`, the template UUID.
 * @returns A 200 NextResponse with `{ status: "success" }` on success.
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return toggleAgentTemplateFavoriteHandler(request, context.params);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
