import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getContentTemplateDetailHandler } from "@/lib/content/getContentTemplateDetailHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * GET /api/content/templates/[id]
 *
 * Returns the full template configuration for a given template id.
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
