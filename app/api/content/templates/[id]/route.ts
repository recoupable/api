import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getContentTemplateDetailHandler } from "@/lib/content/getContentTemplateDetailHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 204 NextResponse carrying the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * GET /api/content/templates/[id]
 *
 * Returns the full template configuration for the given template id — the image,
 * video, caption, and edit presets used elsewhere under `/api/content/*`. Requires
 * `x-api-key` or `Authorization: Bearer`.
 *
 * @param request - The incoming request. Authentication only; no query or body.
 * @param context - Route context from Next.js.
 * @param context.params - Promise resolving to `{ id }`, the template id from the URL path.
 * @returns A 200 NextResponse with the full `Template` object, 401 when
 *   unauthenticated, or 404 when the template id is unknown.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return getContentTemplateDetailHandler(request, context);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
