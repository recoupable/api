import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAccountArtistIds } from "@/lib/supabase/account_artist_ids/getAccountArtistIds";
import { insertAccountArtistId } from "@/lib/supabase/account_artist_ids/insertAccountArtistId";
import type { AddArtistParams } from "@/lib/accounts/validateAddArtistRequest";

/**
 * Links an artist to an account's artist list (the business step of
 * POST /api/accounts/artists). Idempotent: returns success without inserting
 * when the link already exists.
 *
 * The account ID must already be resolved from the authenticated credential
 * (see validateAddArtistRequest) — never from unauthenticated user input.
 *
 * @param params - The resolved account ID and artist ID to link
 * @returns NextResponse with success status
 */
export async function linkArtistToAccount({
  accountId,
  artistId,
}: AddArtistParams): Promise<NextResponse> {
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
    console.error("[ERROR] Failed to link artist to account:", error);
    return NextResponse.json(
      { message: "Failed to add artist to account" },
      { status: 400, headers: getCorsHeaders() },
    );
  }
}
