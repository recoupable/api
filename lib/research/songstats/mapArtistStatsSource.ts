const SONGSTATS_ARTIST_STATS_SOURCE_BY_PLATFORM: Record<string, string> = {
  amazon: "amazon",
  bandsintown: "bandsintown",
  deezer: "deezer",
  facebook: "facebook",
  instagram: "instagram",
  radio: "radio",
  soundcloud: "soundcloud",
  spotify: "spotify",
  sxm: "sxm",
  tiktok: "tiktok",
  twitter: "twitter",
  youtube_artist: "youtube",
  youtube_channel: "youtube",
};

/**
 * Maps a legacy stats platform to its SongStats artist stats source.
 */
export function mapArtistStatsSource(source: string): string {
  return SONGSTATS_ARTIST_STATS_SOURCE_BY_PLATFORM[source] || source;
}
