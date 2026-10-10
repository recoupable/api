import { NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { readPlayerReport } from "@/lib/players/readPlayerReport";
import { SiteError } from "@/lib/sites/SiteError";
import { ZodError } from "zod";
/**
 * Private 30-day browser listening summary and paginated fan-linked playback history.
 *
 * @param request - Incoming HTTP request.
 * @param root0 - Route context.
 * @param root0.params - Player route parameters.
 * @returns HTTP response.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) return auth;
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  try {
    const { id } = await params;
    return NextResponse.json(
      await readPlayerReport(auth.accountId, id, Object.fromEntries(request.nextUrl.searchParams)),
      { headers },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof SiteError ? error.message : "Listening report unavailable" },
      {
        status: error instanceof SiteError ? error.status : error instanceof ZodError ? 400 : 503,
        headers,
      },
    );
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
