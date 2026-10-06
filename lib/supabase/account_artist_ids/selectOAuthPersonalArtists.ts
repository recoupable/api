import supabase from "../serverClient";

/** Direct ownership only: never inherit administrator or organization membership. */
export async function selectOAuthPersonalArtists(accountId: string) {
  const { data, error } = await supabase
    .from("account_artist_ids")
    .select(
      `
    artist:accounts!account_artist_ids_artist_id_fkey (
      id, name,
      organizations:artist_organization_ids!artist_organization_ids_artist_id_fkey (organization_id)
    )
  `,
    )
    .eq("account_id", accountId);
  if (error || !data) throw new Error("Artist access unavailable");
  return data.flatMap(row =>
    row.artist && row.artist.organizations.length === 0
      ? [{ id: row.artist.id, name: row.artist.name }]
      : [],
  );
}
