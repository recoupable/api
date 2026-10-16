import { z } from "zod";
import { CSV_MALFORMED_REASONS } from "./csvRecordTypes";

export const CATALOG_EXPORT_PARSER_VERSION = "catalog-export-csv-v1";

export const CATALOG_EXPORT_FIELDS = [
  "track_title",
  "artist_name",
  "release_title",
  "isrc",
  "upc",
  "release_date",
  "label",
  "track_number",
] as const;

export const catalogExportFieldSchema = z.enum(CATALOG_EXPORT_FIELDS);
export type CatalogExportField = z.infer<typeof catalogExportFieldSchema>;

const columnIndex = z.int().nonnegative();
const ordinal = z.int().positive();
const count = z.int().nonnegative();
const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);

/** Column index (0-based) of each recognised field in the export header, when present. */
export const catalogExportFieldPointersSchema = z.object({
  track_title: columnIndex.optional(),
  artist_name: columnIndex.optional(),
  release_title: columnIndex.optional(),
  isrc: columnIndex.optional(),
  upc: columnIndex.optional(),
  release_date: columnIndex.optional(),
  label: columnIndex.optional(),
  track_number: columnIndex.optional(),
});
export type CatalogExportFieldPointers = z.infer<typeof catalogExportFieldPointersSchema>;

/**
 * Identifier shape check only. `present` means the cell matched the ISRC or UPC/EAN shape after
 * space/hyphen/case normalisation; `malformed` keeps the raw text and no value; `unknown` means the
 * cell was empty; `uncollected` means the export has no recognised column for it. Nothing is
 * generated, padded or repaired, and each state allows only its own value/raw combination.
 */
export const catalogExportIdentifierSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("present"), value: z.string().min(1), raw: z.string().min(1) }),
  z.object({ state: z.literal("malformed"), value: z.null(), raw: z.string().min(1) }),
  z.object({ state: z.literal("unknown"), value: z.null(), raw: z.null() }),
  z.object({ state: z.literal("uncollected"), value: z.null(), raw: z.null() }),
]);
export type CatalogExportIdentifier = z.infer<typeof catalogExportIdentifierSchema>;

/** Trimmed cell text carried as plain strings; dates and track numbers are not interpreted. */
export const catalogExportClaimsSchema = z.object({
  trackTitle: z.string().optional(),
  artistName: z.string().optional(),
  releaseTitle: z.string().optional(),
  releaseDate: z.string().optional(),
  label: z.string().optional(),
  trackNumber: z.string().optional(),
});
export type CatalogExportClaims = z.infer<typeof catalogExportClaimsSchema>;

/**
 * One extracted row. `status` is the literal `proposed`: this module has no producer for a
 * reviewed or accepted state, so a proposal can never be mistaken for a reviewed assertion.
 */
export const catalogExportProposalSchema = z.object({
  kind: z.literal("catalog_export_row"),
  status: z.literal("proposed"),
  pointer: z.object({
    row: ordinal,
    line: ordinal,
    fields: catalogExportFieldPointersSchema,
  }),
  claims: catalogExportClaimsSchema,
  identifiers: z.object({
    isrc: catalogExportIdentifierSchema,
    upc: catalogExportIdentifierSchema,
  }),
  unmappedFields: z.array(z.object({ column: columnIndex, header: z.string(), value: z.string() })),
  rawCells: z.array(z.string()),
});
export type CatalogExportProposal = z.infer<typeof catalogExportProposalSchema>;

export const catalogExportMalformedRowSchema = z.object({
  row: ordinal,
  line: ordinal,
  reason: z.enum(CSV_MALFORMED_REASONS),
  rawCells: z.array(z.string()),
});
export type CatalogExportMalformedRow = z.infer<typeof catalogExportMalformedRowSchema>;

export const catalogExportDuplicateSchema = z.object({
  kind: z.enum(["same_isrc", "same_row_content"]),
  value: z.string().nullable(),
  rows: z.array(ordinal).min(2),
});
export type CatalogExportDuplicate = z.infer<typeof catalogExportDuplicateSchema>;

export const catalogExportParseResultSchema = z.object({
  parserVersion: z.literal(CATALOG_EXPORT_PARSER_VERSION),
  profileVersion: z.string().min(1),
  /**
   * SHA-256 of the UTF-8 encoding of the decoded text that was parsed. It is not the byte hash of
   * a retained original (a decoder may strip a byte-order mark or replace invalid bytes), so source
   * versions must stay keyed on the original's own byte SHA-256.
   */
  contentFingerprint: sha256Hex,
  headerFingerprint: sha256Hex,
  header: z.object({
    columns: z.array(z.string()),
    fields: catalogExportFieldPointersSchema,
    unmappedColumns: z.array(columnIndex),
  }),
  rowCount: count,
  proposals: z.array(catalogExportProposalSchema),
  malformedRows: z.array(catalogExportMalformedRowSchema),
  duplicates: z.array(catalogExportDuplicateSchema),
  summary: z.object({
    proposed: count,
    malformed: count,
    duplicate: count,
    missingIsrc: count,
    malformedIsrc: count,
    missingUpc: count,
    malformedUpc: count,
    uncollectedIsrc: count,
    uncollectedUpc: count,
  }),
});
export type CatalogExportParseResult = z.infer<typeof catalogExportParseResultSchema>;
