import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { recordSiteActivity } from "@/lib/sites/activity/recordSiteActivity";
import { limitSiteRequest } from "@/lib/sites/activity/limitSiteRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { SiteError } from "@/lib/sites/SiteError";
/**
 * Fixed first-party event vocabulary; no free-form fan data is accepted.
 *
 * @param request - Incoming site request.
 * @param root0 - Route context.
 * @param root0.params - Site identifier.
 * @returns HTTP response.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const headers = { ...getCorsHeaders(), "Cache-Control": "no-store" };
  try {
    const { id } = await params;
    z.string().uuid().parse(id);
    const body = await request.text();
    if (body.length > 1024) throw new SiteError(413, "Event too large");
    await limitSiteRequest(id, "activity", 600);
    return NextResponse.json(await recordSiteActivity(id, JSON.parse(body)), { headers });
  } catch (error) {
    return NextResponse.json(
      { error: "Could not record site activity" },
      {
        headers,
        status:
          error instanceof SiteError
            ? error.status
            : error instanceof ZodError || error instanceof SyntaxError
              ? 400
              : 503,
      },
    );
  }
}
/** Browser preflight for public events.
 *
 * @returns HTTP response.
 */
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
