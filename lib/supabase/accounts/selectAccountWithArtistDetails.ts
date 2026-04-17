import supabase from "../serverClient";

/**
 * Retrieves an account with artist-facing relations needed for artist responses.
 *
 * @param artistId - The artist account ID to fetch
 * @returns The account with related info and socials, or null if not found
 */
export async function selectAccountWithArtistDetails(artistId: string) {
  const { data, error } = await supabase
    .from("accounts")
    .select("*, account_info(*), account_socials(*, social:socials(*))")
    .eq("id", artistId)
    .single();

  if (error) {
    return null;
  }

  return data;
}
