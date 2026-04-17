import { NextRequest, NextResponse } from "next/server";
import { updateArtistSocials } from "@/lib/artist/updateArtistSocials";
import { getFormattedArtist } from "@/lib/artists/getFormattedArtist";
import { setAccountArtistPin } from "@/lib/artists/setAccountArtistPin";
import { upsertArtistInfoFields } from "@/lib/artists/upsertArtistInfoFields";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectAccountArtistId } from "@/lib/supabase/account_artist_ids/selectAccountArtistId";
import { selectAccountWithArtistDetails } from "@/lib/supabase/accounts/selectAccountWithArtistDetails";
import { updateAccount } from "@/lib/supabase/accounts/updateAccount";
import { validateUpdateArtistRequest } from "./validateUpdateArtistRequest";

/**
 * Handles PATCH /api/artists/{id}.
 *
 * @param request - The incoming request
 * @param params - Route params containing the artist account ID
 * @returns A NextResponse with the updated artist payload or an error
 */
export async function updateArtistHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const validated = await validateUpdateArtistRequest(request, id);

    if (validated instanceof NextResponse) {
      return validated;
    }

    const {
      artistId,
      requesterAccountId,
      name,
      image,
      instruction,
      label,
      knowledges,
      profileUrls,
      pinned,
    } = validated;

    if (name) {
      await updateAccount(artistId, { name });
    }

    await upsertArtistInfoFields({ artistId, image, instruction, label, knowledges });

    if (profileUrls) {
      await updateArtistSocials(artistId, profileUrls);
    }

    if (pinned !== undefined) {
      await setAccountArtistPin({
        accountId: requesterAccountId,
        artistId,
        pinned,
      });
    }

    const [updatedArtist, pinRow] = await Promise.all([
      selectAccountWithArtistDetails(artistId),
      selectAccountArtistId(requesterAccountId, artistId),
    ]);

    if (!updatedArtist) {
      return NextResponse.json(
        {
          status: "error",
          error: "Artist not found",
        },
        {
          status: 404,
          headers: getCorsHeaders(),
        },
      );
    }

    return NextResponse.json(
      {
        artist: getFormattedArtist({ ...updatedArtist, pinned: pinRow?.pinned ?? false }),
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] updateArtistHandler:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Internal server error",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
