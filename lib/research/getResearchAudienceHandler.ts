import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireArtist } from "@/lib/research/requireArtist";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";
import { jsonSuccess, jsonError } from "@/lib/networking/jsonResponse";

/**
 * GET /api/research/audience
 *
 * Returns audience demographic stats for the given artist on a specific platform.
 * Accepts optional `platform` query param (defaults to "instagram").
 * The platform is embedded in the path, not passed as a query param.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchAudienceHandler(request: NextRequest) {
  const gate = await requireArtist(request);
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform") || "instagram";

  const result = await handleArtistResearch({
    artist: gate.artist,
    accountId: gate.accountId,
    path: cmId => `/artist/${cmId}/${platform}-audience-stats`,
  });

  if ("error" in result) return jsonError(result.status, result.error);
  const data = result.data;
  const body =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : { data };
  return jsonSuccess(body);
}
