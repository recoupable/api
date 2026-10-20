import { createHash } from "node:crypto";
import { assertSupportedCatalogExportText } from "./assertSupportedCatalogExportText";
import { buildCatalogExportProposal } from "./buildCatalogExportProposal";
import {
  CATALOG_EXPORT_PARSER_VERSION,
  type CatalogExportFieldPointers,
  type CatalogExportIdentifier,
  type CatalogExportParseResult,
} from "./catalogExportTypes";
import { ContextImportError } from "./ContextImportError";
import { findCatalogExportDuplicates } from "./findCatalogExportDuplicates";
import { parseCsvRecords } from "./parseCsvRecords";
import {
  CATALOG_EXPORT_PROFILE_VERSION,
  resolveCatalogExportField,
} from "./resolveCatalogExportField";

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
  if (records.header.length === 1 && /[\t;]/.test(records.header[0]))
    throw new ContextImportError(
      "unsupported_input",
      "Only comma-delimited CSV is supported; the header looks tab- or semicolon-delimited",
    );

  const fields: CatalogExportFieldPointers = {};
  const unmappedColumns: number[] = [];
  records.header.forEach((column, index) => {
    const field = resolveCatalogExportField(column);
    if (field && fields[field] === undefined) fields[field] = index;
    else unmappedColumns.push(index);
  });

  const proposals = records.rows.map(row =>
    buildCatalogExportProposal(row, records.header, fields, unmappedColumns),
  );
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
      uncollectedIsrc: countIdentifiers("isrc", "uncollected"),
      uncollectedUpc: countIdentifiers("upc", "uncollected"),
    },
  };
}
