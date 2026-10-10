import type {
  CatalogExportClaims,
  CatalogExportField,
  CatalogExportFieldPointers,
  CatalogExportProposal,
} from "./catalogExportTypes";
import { classifyCatalogIdentifier } from "./classifyCatalogIdentifier";
import type { CsvRecordRow } from "./csvRecordTypes";

const CLAIM_FIELDS: ReadonlyArray<[CatalogExportField, keyof CatalogExportClaims]> = [
  ["track_title", "trackTitle"],
  ["artist_name", "artistName"],
  ["release_title", "releaseTitle"],
  ["release_date", "releaseDate"],
  ["label", "label"],
  ["track_number", "trackNumber"],
];

/**
 * Builds the `proposed` catalog export row for one well-formed CSV record.
 *
 * Claims are trimmed cell text (empty cells are omitted), identifiers are shape-checked only, and
 * every unmapped column plus the untouched raw cells are carried alongside so nothing is lost.
 *
 * @param row - Well-formed record with its row and line pointers.
 * @param header - Verbatim header cells.
 * @param fields - Column index of each recognised field.
 * @param unmappedColumns - Column indexes that did not resolve to a field.
 * @returns The proposal for this row.
 */
export function buildCatalogExportProposal(
  row: CsvRecordRow,
  header: readonly string[],
  fields: CatalogExportFieldPointers,
  unmappedColumns: readonly number[],
): CatalogExportProposal {
  const cellAt = (field: CatalogExportField): string | undefined => {
    const index = fields[field];
    return index === undefined ? undefined : row.cells[index];
  };
  const claims: CatalogExportClaims = {};
  for (const [field, key] of CLAIM_FIELDS) {
    const value = cellAt(field)?.trim();
    if (value) claims[key] = value;
  }
  return {
    kind: "catalog_export_row",
    status: "proposed",
    pointer: { row: row.rowNumber, line: row.line, fields: { ...fields } },
    claims,
    identifiers: {
      isrc: classifyCatalogIdentifier("isrc", cellAt("isrc")),
      upc: classifyCatalogIdentifier("upc", cellAt("upc")),
    },
    unmappedFields: unmappedColumns.map(column => ({
      column,
      header: header[column],
      value: row.cells[column],
    })),
    rawCells: [...row.cells],
  };
}
