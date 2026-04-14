import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { listTemplates } from "@/lib/content/templates";

/**
 * Get Content Templates Handler.
 *
 * @param request - Parameter.
 * @returns - Result.
 */
export async function getContentTemplatesHandler(request: NextRequest): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  return NextResponse.json(
    {
      status: "success",
      templates: listTemplates(),
    },
    { status: 200, headers: getCorsHeaders() },
  );
}
