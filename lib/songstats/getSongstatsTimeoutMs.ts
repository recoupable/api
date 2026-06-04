import { getDefaultSongstatsTimeoutMs } from "@/lib/songstats/getDefaultSongstatsTimeoutMs";

/**
 * Resolves the SongStats request timeout from env, falling back to path defaults.
 */
export function getSongstatsTimeoutMs(path: string): number {
  const configured = Number.parseInt(process.env.SONGSTATS_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : getDefaultSongstatsTimeoutMs(path);
}
