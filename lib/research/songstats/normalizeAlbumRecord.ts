import { isRecord } from "@/lib/research/songstats/isRecord";
import { omitKeys, PROVIDER_ALBUM_ID_ALIASES } from "@/lib/research/songstats/providerIdAliases";
import { pickString } from "@/lib/research/songstats/pickString";

/**
 * Adds a provider-neutral `id` and removes SongStats-specific album id alias fields.
 */
export function normalizeAlbumRecord(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const id = pickString(value, ["songstats_album_id", "album_id", "id"]);
  if (!id) return value;

  return { ...omitKeys(value, PROVIDER_ALBUM_ID_ALIASES), id };
}
