import { isRecord } from "@/lib/research/songstats/isRecord";
import { omitKeys, PROVIDER_ARTIST_ID_ALIASES } from "@/lib/research/songstats/providerIdAliases";
import { pickString } from "@/lib/research/songstats/pickString";

/**
 * Adds a provider-neutral `id` and removes SongStats-specific id alias fields.
 */
export function normalizeArtistRecord(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const id = pickString(value, ["songstats_artist_id", "artist_id", "id"]);
  if (!id) return value;

  return { ...omitKeys(value, PROVIDER_ARTIST_ID_ALIASES), id };
}
