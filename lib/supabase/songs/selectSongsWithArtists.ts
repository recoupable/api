import supabase from "../serverClient";

type SelectSongsWithArtistsParams = {
  isrc?: string;
  artist_account_id?: string;
};

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
      song_artists!inner (
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
    query = query.eq("isrc", params.isrc);
  }

  if (params.artist_account_id) {
    query = query.eq("song_artists.artist", params.artist_account_id);
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
