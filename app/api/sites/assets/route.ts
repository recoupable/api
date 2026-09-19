import { NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { processSiteAsset } from "@/lib/sites/processSiteAsset";
import { siteResponseError } from "@/lib/sites/siteResponseError";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
/**
 * Upload workspace-owned artwork or audio.
 *
 * @param request - Request or route context.
 * @returns HTTP response.
 */
export async function POST(request: NextRequest) {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const data = await request.formData();
    return NextResponse.json(
      await processSiteAsset(
        auth.accountId,
        request.nextUrl.searchParams.get("organizationId"),
        data.get("file"),
      ),
      { headers: getCorsHeaders() },
    );
  } catch (error) {
    return siteResponseError(error);
  }
}
/**
 * Browser preflight.
 *
 * @returns HTTP response.
 */
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
