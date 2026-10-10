import { createHash } from "node:crypto";
import { assertSupportedCatalogExportText } from "./assertSupportedCatalogExportText";
import { CATALOG_EXPORT_PROFILE_VERSION, resolveCatalogExportField } from "./catalogExportColumns";
import {
  CATALOG_EXPORT_PARSER_VERSION,
  type CatalogExportClaims,
  type CatalogExportField,
  type CatalogExportFieldPointers,
  type CatalogExportIdentifier,
  type CatalogExportParseResult,
  type CatalogExportProposal,
} from "./catalogExportTypes";
import { classifyCatalogIdentifier } from "./classifyCatalogIdentifier";
import { ContextImportError } from "./contextImportError";
import { findCatalogExportDuplicates } from "./findCatalogExportDuplicates";
import { parseCsvRecords } from "./parseCsvRecords";

const CLAIM_FIELDS: ReadonlyArray<[CatalogExportField, keyof CatalogExportClaims]> = [
  ["track_title", "trackTitle"],
  ["artist_name", "artistName"],
  ["release_title", "releaseTitle"],
  ["release_date", "releaseDate"],
  ["label", "label"],
  ["track_number", "trackNumber"],
];

const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

/**
 * Deterministically parses a generic catalog export CSV into row proposals.
 *
 * Pure and side-effect free: the same text always yields an identical result, including the
 * content and header fingerprints that let a later slice recognise exact replays and changed
 * versions of the same export. Every proposal carries a row/line/field pointer back into the
 * source and is marked `proposed`; nothing here reviews, accepts, links or persists anything,
 * and cell text (including instruction-like text) is carried as plain data.
 *
 * @param text - UTF-8 decoded CSV text of the export.
 * @returns Proposals, malformed rows, duplicate signals and a summary with versioned provenance.
 * @throws ContextImportError for unsupported, empty, header-less or over-cap input; never a partial result.
 */
export function parseCatalogExport(text: string): CatalogExportParseResult {
  assertSupportedCatalogExportText(text);
  if (text.replace(/^﻿/, "").trim() === "")
    throw new ContextImportError("empty_input", "Catalog export is empty");

  const records = parseCsvRecords(text);
  if (records.header.every(column => column.trim() === ""))
    throw new ContextImportError("header_missing", "Catalog export has no usable header row");

  const fields: CatalogExportFieldPointers = {};
  const unmappedColumns: number[] = [];
  records.header.forEach((column, index) => {
    const field = resolveCatalogExportField(column);
    if (field && fields[field] === undefined) fields[field] = index;
    else unmappedColumns.push(index);
  });

  const proposals: CatalogExportProposal[] = records.rows.map(row => {
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
        header: records.header[column],
        value: row.cells[column],
      })),
      rawCells: [...row.cells],
    };
  });

  const malformedRows = records.malformed.map(row => ({
    row: row.rowNumber,
    line: row.line,
    reason: row.reason,
    rawCells: [...row.cells],
  }));
  const duplicates = findCatalogExportDuplicates(proposals);
  const duplicateRows = new Set(duplicates.flatMap(duplicate => duplicate.rows));
  const countIdentifiers = (
    kind: "isrc" | "upc",
    state: CatalogExportIdentifier["state"],
  ): number => proposals.filter(proposal => proposal.identifiers[kind].state === state).length;

  return {
    parserVersion: CATALOG_EXPORT_PARSER_VERSION,
    profileVersion: CATALOG_EXPORT_PROFILE_VERSION,
    contentFingerprint: sha256(text),
    headerFingerprint: sha256(JSON.stringify(records.header)),
    header: { columns: [...records.header], fields, unmappedColumns },
    rowCount: records.rows.length + records.malformed.length,
    proposals,
    malformedRows,
    duplicates,
    summary: {
      proposed: proposals.length,
      malformed: malformedRows.length,
      duplicate: duplicateRows.size,
      missingIsrc: countIdentifiers("isrc", "unknown"),
      malformedIsrc: countIdentifiers("isrc", "malformed"),
      missingUpc: countIdentifiers("upc", "unknown"),
      malformedUpc: countIdentifiers("upc", "malformed"),
    },
  };
}
