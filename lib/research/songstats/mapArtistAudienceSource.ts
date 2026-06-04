const SONGSTATS_ARTIST_METRIC_SOURCE_BY_PLATFORM: Record<string, string> = {
  bandsintown: "bandsintown_followers",
  deezer: "deezer_fans",
  facebook: "facebook_likes",
  instagram: "instagram_followers",
  line: "line_followers",
  melon: "melon_followers",
  soundcloud: "soundcloud_followers",
  spotify: "spotify_streams",
  tiktok: "tiktok_followers",
  twitch: "twitch_followers",
  twitter: "twitter_followers",
  wikipedia: "wikipedia_views",
  youtube_artist: "youtube_artist_subscribers",
  youtube_channel: "youtube_channel_subscribers",
};

/**
 * Maps a legacy audience platform to its SongStats audience metric source.
 */
export function mapArtistAudienceSource(source: string): string {
  return SONGSTATS_ARTIST_METRIC_SOURCE_BY_PLATFORM[source] || source;
}
