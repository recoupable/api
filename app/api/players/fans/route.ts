import { NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { readWorkspacePlayerFans } from "@/lib/players/readWorkspacePlayerFans";
import { SiteError } from "@/lib/sites/SiteError";
import { ZodError } from "zod";
/**
 * Read deduplicated workspace fan contacts after authentication and membership authorization.
 *
 * @param request - Incoming authenticated request and pagination query.
 * @returns Private workspace fan profiles or an access/validation error.
 */
export async function GET(request: NextRequest) {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) return auth;
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  try {
    return NextResponse.json(
      await readWorkspacePlayerFans(
        auth.accountId,
        Object.fromEntries(request.nextUrl.searchParams),
      ),
      { headers },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof SiteError ? error.message : "Fan list unavailable" },
      {
        status: error instanceof SiteError ? error.status : error instanceof ZodError ? 400 : 503,
        headers,
      },
    );
  }
}
/**
 * Browser preflight; does not return fan data.
 *
 * @returns Empty preflight response.
 */
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
