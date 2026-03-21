interface Track {
  name: string;
  popularity: number;
}

export interface CatalogDepth {
  track_count: number;
  avg_popularity: number;
  top_track_popularity: number;
  /** Std deviation of track popularities — low = consistent catalog, high = hit-driven */
  popularity_std_dev: number;
  /** 0–100: how consistent the catalog is. 100 = every track equally popular */
  consistency_score: number;
  /** % of total streams concentrated in the top track (proxy) */
  top_track_concentration_pct: number;
  /** "consistent" | "hit_driven" | "emerging" */
  catalog_type: "consistent" | "hit_driven" | "emerging";
  catalog_type_label: string;
  /** Tracks ranked by popularity */
  ranked_tracks: Array<{ name: string; popularity: number }>;
}

/**
 * Analyses catalog depth from Spotify top-track data.
 * Computes consistency scores and catalog type without any AI inference —
 * all metrics are derived from actual Spotify popularity numbers.
 *
 * @param topTracks - Up to 10 Spotify top tracks for the artist.
 * @returns Catalog depth metrics, or null if no tracks.
 */
export function analyzeCatalogDepth(topTracks: Track[]): CatalogDepth | null {
  if (!topTracks || topTracks.length === 0) return null;

  const popularities = topTracks.map(t => t.popularity);
  const track_count = topTracks.length;
  const avg_popularity = Math.round(popularities.reduce((s, p) => s + p, 0) / track_count);
  const top_track_popularity = Math.max(...popularities);

  // Standard deviation
  const variance =
    popularities.reduce((sum, p) => sum + Math.pow(p - avg_popularity, 2), 0) / track_count;
  const popularity_std_dev = Math.round(Math.sqrt(variance) * 10) / 10;

  // Consistency score: invert std dev normalised to 0-100
  // std dev of 0 = 100 (perfect consistency), std dev of 30+ = 0
  const consistency_score = Math.max(0, Math.round(100 - (popularity_std_dev / 30) * 100));

  // Top-track concentration: what share of the "popularity budget" the top track commands
  const total_popularity = popularities.reduce((s, p) => s + p, 0);
  const top_track_concentration_pct =
    total_popularity > 0 ? Math.round((top_track_popularity / total_popularity) * 100) : 0;

  // Catalog type classification
  let catalog_type: CatalogDepth["catalog_type"];
  let catalog_type_label: string;

  if (avg_popularity < 30) {
    catalog_type = "emerging";
    catalog_type_label = "Emerging — building catalog traction";
  } else if (consistency_score >= 60 && top_track_concentration_pct < 25) {
    catalog_type = "consistent";
    catalog_type_label = "Consistent — multiple tracks with similar momentum";
  } else {
    catalog_type = "hit_driven";
    catalog_type_label = "Hit-Driven — breakout track anchoring the catalog";
  }

  const ranked_tracks = [...topTracks]
    .sort((a, b) => b.popularity - a.popularity)
    .map(t => ({ name: t.name, popularity: t.popularity }));

  return {
    track_count,
    avg_popularity,
    top_track_popularity,
    popularity_std_dev,
    consistency_score,
    top_track_concentration_pct,
    catalog_type,
    catalog_type_label,
    ranked_tracks,
  };
}
