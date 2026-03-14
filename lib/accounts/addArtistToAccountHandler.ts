import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectAccountByEmail } from "@/lib/supabase/account_emails/selectAccountByEmail";
import { getAccountArtistIds } from "@/lib/supabase/account_artist_ids/getAccountArtistIds";
import { insertAccountArtistId } from "@/lib/supabase/account_artist_ids/insertAccountArtistId";
import type { AddArtistBody } from "./validateAddArtistBody";

/**
 * Handles POST /api/accounts/artists - Add artist to account's artist list.
 *
 * @param body - Validated request body with email and artistId
 * @returns NextResponse with success status
 */
export async function addArtistToAccountHandler(body: AddArtistBody): Promise<NextResponse> {
  const { email, artistId } = body;

  try {
    // Find account by email
    const accountEmail = await selectAccountByEmail(email);
    if (!accountEmail?.account_id) {
      return NextResponse.json(
        { message: "Not found account." },
        { status: 400, headers: getCorsHeaders() },
      );
    }

    const accountId = accountEmail.account_id;

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
