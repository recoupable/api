import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { selectArtistFanSegments } from "@/lib/supabase/artist_fan_segment/selectArtistFanSegments";

interface GetFanSegmentsParams {
  artistId: string;
}

/**
 * Handler for GET /api/artist/get_fan_segments
 *
 * Fetches fan segments for an artist by looking up their social accounts
 * and then querying the artist_fan_segment table.
 */
export async function getFanSegmentsHandler({
  artistId,
}: GetFanSegmentsParams): Promise<NextResponse> {
  if (!artistId) {
    return NextResponse.json(
      { message: "artistId is required" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  try {
    const accountSocials = await selectAccountSocials(artistId);
    if (!accountSocials) {
      return NextResponse.json(
        { message: "failed" },
        { status: 400, headers: getCorsHeaders() },
      );
    }

    const socialIds = accountSocials.map(
      (accountSocial) => (accountSocial.social as any)?.id as string,
    );

    const fanSegments = await selectArtistFanSegments(socialIds);

    return NextResponse.json(
      { fan_segments: fanSegments },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    return NextResponse.json({ message }, { status: 400, headers: getCorsHeaders() });
  }
}
