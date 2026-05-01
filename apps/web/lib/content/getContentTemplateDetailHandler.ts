import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { loadTemplate } from "@/lib/content/templates";

/**
 * Handler for GET /api/content/templates/{id}.
 *
 * @param request - Incoming API request.
 * @param params - Route params containing the template id.
 * @returns The full template object, or 404 if not found.
 */
export async function getContentTemplateDetailHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await params;
  const template = loadTemplate(id);

  if (!template) {
    return NextResponse.json(
      { status: "error", error: "Template not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  return NextResponse.json(template, { status: 200, headers: getCorsHeaders() });
}
