import { CATALOG_EXPORT_FIELDS, type CatalogExportField } from "./catalogExportTypes";

export const CATALOG_EXPORT_PROFILE_VERSION = "generic-catalog-export-v1";

/**
 * Header aliases for the generic profile, written in normalised form (lower case, separators
 * collapsed to single spaces). Deliberately small and distributor-neutral: unknown columns are
 * retained verbatim on each proposal rather than guessed.
 */
export const CATALOG_EXPORT_HEADER_ALIASES: Readonly<
  Record<CatalogExportField, readonly string[]>
> = {
  track_title: ["track title", "title", "track name", "song title", "song", "recording title"],
  artist_name: ["artist name", "artist", "artists", "primary artist", "track artist", "performer"],
  release_title: ["release title", "release", "album", "album title", "album name"],
  isrc: ["isrc"],
  upc: ["upc", "ean", "upc/ean", "upc ean", "barcode", "gtin"],
  release_date: ["release date", "original release date"],
  label: ["label", "label name", "record label"],
  track_number: ["track number", "track no", "track no.", "track #", "trackno"],
};

const normalizeHeader = (header: string): string =>
  header
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .trim();

/**
 * Resolves one export header cell to a generic catalog field, or null when it is not recognised.
 *
 * Matching is case-, whitespace-, underscore- and hyphen-insensitive and otherwise exact, so a
 * header such as "Date Added" is left unmapped rather than treated as a release date.
 *
 * @param header - Verbatim header cell from the export.
 * @returns The matching field name, or null for an unmapped column.
 */
export function resolveCatalogExportField(header: string): CatalogExportField | null {
  const normalized = normalizeHeader(header);
  if (!normalized) return null;
  for (const field of CATALOG_EXPORT_FIELDS)
    if (CATALOG_EXPORT_HEADER_ALIASES[field].includes(normalized)) return field;
  return null;
}
