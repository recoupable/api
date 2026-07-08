import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAccountArtistIds } from "@/lib/supabase/account_artist_ids/getAccountArtistIds";
import { insertAccountArtistId } from "@/lib/supabase/account_artist_ids/insertAccountArtistId";

/**
 * Handles POST /api/accounts/artists - Add artist to account's artist list.
 *
 * The account ID must already be resolved from the authenticated credential
 * (see resolveAddArtistAccountId) — never from unauthenticated user input.
 *
 * @param params - The resolved account ID and artist ID to link
 * @returns NextResponse with success status
 */
export async function addArtistToAccountHandler({
  accountId,
  artistId,
}: {
  accountId: string;
  artistId: string;
}): Promise<NextResponse> {
  try {
    // Check if artist is already associated with account
    const existingArtists = await getAccountArtistIds({ accountIds: [accountId] });
    const alreadyExists = existingArtists.some(a => a.artist_id === artistId);

    if (alreadyExists) {
      return NextResponse.json({ success: true }, { status: 200, headers: getCorsHeaders() });
    }

    // Add artist to account
    await insertAccountArtistId(accountId, artistId);

    return NextResponse.json({ success: true }, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    return NextResponse.json({ message }, { status: 400, headers: getCorsHeaders() });
  }
}
