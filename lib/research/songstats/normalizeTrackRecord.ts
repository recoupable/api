import { isRecord } from "@/lib/research/songstats/isRecord";
import { omitKeys, PROVIDER_TRACK_ID_ALIASES } from "@/lib/research/songstats/providerIdAliases";
import { pickString } from "@/lib/research/songstats/pickString";

/**
 * Adds a provider-neutral `id` and removes SongStats-specific id alias fields.
 */
export function normalizeTrackRecord(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const id = pickString(value, ["songstats_track_id", "track_id", "id"]);
  if (!id) return value;

  return { ...omitKeys(value, PROVIDER_TRACK_ID_ALIASES), id };
}
