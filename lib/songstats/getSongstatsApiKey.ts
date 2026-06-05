/**
 * Returns the configured SongStats API key, if any.
 */
export function getSongstatsApiKey(): string | undefined {
  return process.env.SONGSTATS_API_KEY;
}
