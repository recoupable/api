import { firstRecord } from "@/lib/research/songstats/firstRecord";
import { omitKeys, PROVIDER_TRACK_ID_ALIASES } from "@/lib/research/songstats/providerIdAliases";
import { pickString } from "@/lib/research/songstats/pickString";

/**
 * Normalizes a track lookup object with a single provider-neutral `id`.
 */
export function normalizeTrackLookupObject(value: unknown): unknown {
  const record = firstRecord(value);
  if (!record) return value;

  const id = pickString(record, ["songstats_track_id", "track_id", "id"]);
  if (!id) return record;

  return { ...omitKeys(record, PROVIDER_TRACK_ID_ALIASES), id };
}
