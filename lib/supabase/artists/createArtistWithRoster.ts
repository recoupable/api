import supabase from "@/lib/supabase/serverClient";
import type { CreateArtistResult } from "@/lib/artists/createArtistInDb";

/** Creates the legacy name-only profile and its relationships in one transaction. */
export async function createArtistWithRoster(
  name: string,
  accountId: string,
  organizationId?: string,
): Promise<CreateArtistResult> {
  const { data, error } = await supabase.rpc("create_artist_with_roster", {
    p_name: name,
    p_account_id: accountId,
    p_organization_id: organizationId ?? null,
  });
  if (error || !data) throw new Error("Could not create artist. Please retry.");
  const artist = data as unknown as CreateArtistResult;
  return {
    ...artist,
    created_at: artist.timestamp ? new Date(artist.timestamp).toISOString() : null,
    updated_at: artist.account_info?.[0]?.updated_at ?? null,
  };
}
