import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { CONTENT_TEMPLATES } from "@/lib/content/contentTemplates";

/**
 * Handler for GET /api/content/templates.
 *
 * @param request
 */
export async function getContentTemplatesHandler(request: NextRequest): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  return NextResponse.json(
    {
      status: "success",
      templates: CONTENT_TEMPLATES,
    },
    { status: 200, headers: getCorsHeaders() },
  );
}
