import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getContentTemplateDetailHandler } from "@/lib/content/getContentTemplateDetailHandler";

/**
 * OPTIONS.
 *
 * @returns - Result.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * GET.
 *
 * @param request - Parameter.
 * @param context - Parameter.
 * @param context.params - Parameter.
 * @returns - Result.
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
