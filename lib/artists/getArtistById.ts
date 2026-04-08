import { getFormattedArtist } from "@/lib/artists/getFormattedArtist";
import { selectAccountWithArtistDetails } from "@/lib/supabase/accounts/selectAccountWithArtistDetails";

export interface ArtistDetail {
  id: string;
  account_id: string;
  name: string;
  image: string | null;
  instruction: string | null;
  knowledges: ReturnType<typeof getFormattedArtist>["knowledges"];
  label: string | null;
  account_socials: ReturnType<typeof getFormattedArtist>["account_socials"];
}

/**
 * Retrieves a single artist by account ID and formats it for the public artist detail route.
 *
 * @param artistId - The artist account ID
 * @returns Artist detail payload or null when not found
 */
export async function getArtistById(artistId: string): Promise<ArtistDetail | null> {
  const account = await selectAccountWithArtistDetails(artistId);

  if (!account) {
    return null;
  }

  const formattedArtist = getFormattedArtist(account);
  const { account_id, name, image, instruction, knowledges, label, account_socials } =
    formattedArtist;

  return {
    id: artistId,
    account_id,
    name,
    image,
    instruction,
    knowledges,
    label,
    account_socials,
  };
}
