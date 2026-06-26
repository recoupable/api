import supabase from "../serverClient";
import { Tables } from "@/types/database.types";

export type CatalogSongWithArtists = {
  catalog_id: string;
} & Tables<"songs"> & {
    artists: Tables<"accounts">[];
  };

type SelectCatalogSongsParams = {
  catalogId?: string;
  isrcs?: string[];
  artistName?: string;
  page?: number;
  limit?: number;
};

type CatalogSongsWithPagination = {
  songs: CatalogSongWithArtists[];
  total_count: number;
};

type SongArtistWithAccount = {
  artist: string;
  accounts: Tables<"accounts">;
};

type CatalogSongQueryResult = {
  catalog: string;
  songs: Tables<"songs"> & {
    song_artists: SongArtistWithAccount[];
  };
};

/**
 * Selects catalog songs with related artist data and pagination info
 *
 * @param params - The parameters for the query
 * @returns The catalog songs with related artist data and pagination info
 * @throws Error if the query fails
 */
export async function selectCatalogSongsWithArtists(
  params: SelectCatalogSongsParams,
): Promise<CatalogSongsWithPagination> {
  const { catalogId, isrcs, artistName, page, limit } = params;

  // When filtering by artistName, inner-join song_artists/accounts so the filter
  // RESTRICTS rows. With a plain LEFT join a non-matching `.eq` only nulls the
  // embed — returning every row with `artists: [null]`, which hides the whole
  // catalog and crashes the row renderer (chat#1801). Without a filter, keep the
  // LEFT join so artist-less captured tracks still surface (api#681).
  const artistsJoin = artistName ? "song_artists!inner" : "song_artists";
  const accountsJoin = artistName ? "accounts!inner" : "accounts";

  let query = supabase
    .from("catalog_songs")
    .select(
      `
      catalog,
      songs!inner (
        isrc,
        name,
        album,
        notes,
        updated_at,
        ${artistsJoin} (
          artist,
          ${accountsJoin} (
            id,
            name,
            timestamp
          )
        )
      )
    `,
      { count: "exact" },
    )
    .order("song", { ascending: false });

  // Only apply pagination if both page and limit are provided
  if (page !== undefined && limit !== undefined) {
    query = query.range((page - 1) * limit, page * limit - 1);
  }

  // Add filters based on provided parameters
  if (catalogId) {
    query = query.eq("catalog", catalogId);
  }

  if (isrcs && isrcs.length > 0) {
    query = query.in("song", isrcs);
  }

  if (artistName) {
    // Filter by artist name in nested song_artists relationship
    query = query.eq("songs.song_artists.accounts.name", artistName);
  }

  const { data, count, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch catalog songs: ${error.message}`);
  }

  // Transform the nested data structure
  const catalogSongs: CatalogSongWithArtists[] = (data || []).map(catalogSong => {
    const { catalog, songs } = catalogSong as unknown as CatalogSongQueryResult;
    const { song_artists, ...songData } = songs;

    return {
      catalog_id: catalog,
      ...songData,
      // filter(Boolean): a LEFT-joined account can be null; never emit `[null]`.
      artists: song_artists?.map((sa: SongArtistWithAccount) => sa.accounts).filter(Boolean) || [],
    };
  });

  return {
    songs: catalogSongs,
    total_count: count ?? 0,
  };
}
