import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { deductCredits } from "@/lib/credits/deductCredits";
import { fetchChartmetric } from "@/lib/research/fetchChartmetric";

/**
 * Playlist detail handler — looks up a playlist by platform and ID, falling back to name search.
 *
 * @param request - query params: platform, id
 * @returns JSON playlist details or error
 */
export async function getResearchPlaylistHandler(request: NextRequest): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;
  const { accountId } = authResult;

  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform");
  const id = searchParams.get("id");

  if (!platform || !id) {
    return NextResponse.json(
      { status: "error", error: "platform and id parameters are required" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const VALID_PLATFORMS = ["spotify", "applemusic", "deezer", "amazon", "youtube"];
  if (!VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json(
      { status: "error", error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}` },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  let playlistId = id;

  if (!/^\d+$/.test(id)) {
    const searchResult = await fetchChartmetric("/search", {
      q: id,
      type: "playlists",
      limit: "1",
    });

    if (searchResult.status !== 200) {
      return NextResponse.json(
        { status: "error", error: `Search failed with status ${searchResult.status}` },
        { status: searchResult.status, headers: getCorsHeaders() },
      );
    }

    const playlists = (
      searchResult.data as { playlists?: { [key: string]: Array<{ id: number }> } }
    )?.playlists?.[platform];

    if (!playlists || playlists.length === 0) {
      return NextResponse.json(
        { status: "error", error: `No playlist found matching "${id}" on ${platform}` },
        { status: 404, headers: getCorsHeaders() },
      );
    }

    playlistId = String(playlists[0].id);
  }

  const result = await fetchChartmetric(`/playlist/${platform}/${playlistId}`);

  if (result.status !== 200) {
    return NextResponse.json(
      { status: "error", error: "Playlist lookup failed" },
      { status: result.status, headers: getCorsHeaders() },
    );
  }

  try {
    await deductCredits({ accountId, creditsToDeduct: 5 });
  } catch {
    // Credit deduction failed but data was fetched — log but don't block
  }

  return NextResponse.json(
    {
      status: "success",
      ...(typeof result.data === "object" && result.data !== null
        ? result.data
        : { data: result.data }),
    },
    { status: 200, headers: getCorsHeaders() },
  );
}
