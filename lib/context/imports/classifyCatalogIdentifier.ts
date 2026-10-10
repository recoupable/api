import type { CatalogExportIdentifier } from "./catalogExportTypes";

const IDENTIFIER_SHAPES = {
  isrc: /^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/,
  upc: /^[0-9]{12,14}$/,
} as const;

/**
 * Classifies one identifier cell by shape only.
 *
 * Hyphens and spaces are removed and letters upper-cased before the ISRC (2 letters, 3
 * alphanumerics, 7 digits) or UPC/EAN/GTIN (12–14 digits) shape is checked. Check digits are not
 * validated and nothing is padded or corrected: a cell that does not fit is `malformed` with its
 * raw text retained, and an empty cell is `unknown`.
 *
 * @param kind - Which identifier shape to apply.
 * @param cell - Verbatim cell text, or undefined when the column is absent.
 * @returns The identifier state with the normalised value only when the shape matched.
 */
export function classifyCatalogIdentifier(
  kind: keyof typeof IDENTIFIER_SHAPES,
  cell: string | undefined,
): CatalogExportIdentifier {
  const raw = cell?.trim() ?? "";
  if (raw === "") return { state: "unknown", value: null, raw: null };
  const compact = raw.replace(/[\s-]/g, "").toUpperCase();
  return IDENTIFIER_SHAPES[kind].test(compact)
    ? { state: "present", value: compact, raw }
    : { state: "malformed", value: null, raw };
}
