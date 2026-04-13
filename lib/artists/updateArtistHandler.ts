import { NextRequest, NextResponse } from "next/server";
import { updateArtistSocials } from "@/lib/artist/updateArtistSocials";
import { getFormattedArtist } from "@/lib/artists/getFormattedArtist";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { insertAccountInfo } from "@/lib/supabase/account_info/insertAccountInfo";
import { selectAccountInfo } from "@/lib/supabase/account_info/selectAccountInfo";
import { updateAccountInfo } from "@/lib/supabase/account_info/updateAccountInfo";
import { selectAccountWithArtistDetails } from "@/lib/supabase/accounts/selectAccountWithArtistDetails";
import { updateAccount } from "@/lib/supabase/accounts/updateAccount";
import { validateUpdateArtistRequest } from "./validateUpdateArtistRequest";

/**
 * Handles PATCH /api/artists/{id}.
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

    const { artistId, name, image, instruction, label, knowledges, profileUrls } = validated;

    if (name) {
      await updateAccount(artistId, { name });
    }

    const existingInfo = await selectAccountInfo(artistId);

    if (!existingInfo) {
      await insertAccountInfo({
        account_id: artistId,
        image,
        instruction,
        knowledges,
        label: label === "" ? null : label,
      });
    } else {
      const nextKnowledges =
        knowledges !== undefined
          ? Array.from(new Map(knowledges.map(knowledge => [knowledge.url, knowledge])).values())
          : existingInfo.knowledges;

      await updateAccountInfo(artistId, {
        image: image ?? existingInfo.image,
        instruction: instruction ?? existingInfo.instruction,
        knowledges: nextKnowledges,
        label: label === undefined ? existingInfo.label : label === "" ? null : label,
      });
    }

    if (profileUrls) {
      await updateArtistSocials(artistId, profileUrls);
    }

    const updatedArtist = await selectAccountWithArtistDetails(artistId);

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
        artist: getFormattedArtist(updatedArtist),
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
