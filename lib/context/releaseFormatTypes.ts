/**
 * Release format as observed in the saved Spotify album payload and projected by
 * `read_context_release_case`. The API passes it through unchanged. Spotify cannot
 * establish reissue or physical format, so those stay the literal "unknown", and a
 * UPC is present only when the provider reported one; nothing is inferred.
 */
export interface ReleaseFormatObservation {
  source: "spotify_album_observation";
  /** "uncollected" until an album observation is saved for the case. */
  state: "observed" | "uncollected";
  observed_type: string | null;
  format_state: "single" | "album" | "compilation" | "unknown";
  reported_total_tracks: number | null;
  release_date: string | null;
  release_date_precision: string | null;
  label: string | null;
  upc: string | null;
  upc_state: "observed" | "not_observed" | "uncollected";
  disc_count: number | null;
  multi_disc: boolean | null;
  reissue: "unknown";
  physical_format: "unknown";
}
