import supabase from "../serverClient";

type SelectSongsWithArtistsParams = {
  isrc?: string;
  artist_account_id?: string;
};

/**
 * Selects songs with their related artist accounts, optionally filtered by
 * `isrc` and/or `artist_account_id`. Results are ordered by `updated_at` DESC
 * to preserve parity with the legacy Express `/songs` route.
 *
 * The nested `song_artists.accounts` embed is flattened into a top-level
 * `artists: Account[]` per song so the wire shape matches the legacy
 * response exactly (chat's `SongsByIsrcResponse`).
 *
 * Types are inferred from the `SupabaseClient<Database>`-typed server client —
 * do not hand-write `Tables<"songs">` shapes here.
 *
 * @param params - Optional `isrc` and/or `artist_account_id` filters.
 * @returns Flattened songs with a populated `artists` array per row.
 * @throws Error if the Supabase query fails.
 */
export async function selectSongsWithArtists(params: SelectSongsWithArtistsParams = {}) {
  let query = supabase
    .from("songs")
    .select(
      `
      isrc,
      name,
      album,
      notes,
      updated_at,
      song_artists (
        artist,
        accounts!inner (
          id,
          name,
          timestamp
        )
      )
    `,
    )
    .order("updated_at", { ascending: false });

  if (params.isrc) {
    query = query.in("isrc", [params.isrc]);
  }

  if (params.artist_account_id) {
    query = query.in("song_artists.artist", [params.artist_account_id]);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch songs: ${error.message}`);
  }

  return (data ?? []).map(song => {
    const { song_artists, ...rest } = song;
    return {
      ...rest,
      artists: (song_artists ?? []).map(sa => sa.accounts).filter(Boolean),
    };
  });
}
