import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { toggleArtistPin } from "@/lib/supabase/account_artist_ids/toggleArtistPin";

interface ToggleArtistPinInput {
  accountId: string;
  artistId: string;
  pinned: unknown;
}

/**
 * Handler for POST /api/artist/pin
 *
 * Toggles the pinned status of an artist for a given account.
 */
export async function toggleArtistPinHandler({
  accountId,
  artistId,
  pinned,
}: ToggleArtistPinInput): Promise<NextResponse> {
  if (!accountId || !artistId || typeof pinned !== "boolean") {
    return NextResponse.json(
      { message: "Missing required fields: accountId, artistId, pinned" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  try {
    const result = await toggleArtistPin({ accountId, artistId, pinned });
    return NextResponse.json(result, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    return NextResponse.json({ message }, { status: 400, headers: getCorsHeaders() });
  }
}
