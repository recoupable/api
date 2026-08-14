interface SpotifyAlbumItem {
  id: string;
  release_date?: string | null;
}

export interface ValuationAlbums {
  /** Deduped album ids, in the order Spotify returned them. */
  albumIds: string[];
  /** Earliest album release date (ISO), or null when there are no albums. */
  earliestReleaseDate: string | null;
}

/**
 * Reduces a Spotify artist-albums list to the inputs the valuation needs: the
 * (deduped) album ids to measure and the earliest release date that anchors the
 * catalog-age term of the value band (see computeValuationBand).
 */
export function extractValuationAlbums(items: SpotifyAlbumItem[]): ValuationAlbums {
  const albumIds = [...new Set(items.map(item => item.id))];

  const dates = items.map(item => item.release_date).filter((d): d is string => Boolean(d));
  const earliestReleaseDate = dates.length
    ? dates.reduce((earliest, d) => (d < earliest ? d : earliest))
    : null;

  return { albumIds, earliestReleaseDate };
}
