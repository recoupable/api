import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { handleResearchRequest } from "@/lib/research/handleResearchRequest";

/**
 * GET /api/research/curator
 *
 * Returns details for a specific playlist curator.
 *
 * @param request - Requires `platform` and `id` query params
 * @returns The JSON response.
 */
export async function getResearchCuratorHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform");
  const id = searchParams.get("id");

  if (!platform || !id) {
    return NextResponse.json(
      { status: "error", error: "platform and id parameters are required" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return handleResearchRequest(request, () => `/curator/${platform}/${id}`);
}
