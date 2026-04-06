import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { handleResearchRequest } from "@/lib/research/handleResearchRequest";

/**
 * GET /api/research/charts
 *
 * Returns global chart positions for a platform. Not artist-scoped.
 * Requires `platform` query param. Optional: `country`, `interval`, `type`.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchChartsHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform");

  if (!platform) {
    return NextResponse.json(
      { status: "error", error: "platform parameter is required" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  if (!/^[a-z]+$/.test(platform)) {
    return NextResponse.json(
      { status: "error", error: "Invalid platform parameter" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return handleResearchRequest(
    request,
    () => `/charts/${platform}`,
    sp => {
      const params: Record<string, string> = {};
      params.country_code = sp.get("country") || "US";
      params.interval = sp.get("interval") || "daily";
      params.type = sp.get("type") || "regional";
      params.latest = sp.get("latest") ?? "true";
      return params;
    },
  );
}
