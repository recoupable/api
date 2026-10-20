export const CSV_MAX_ROWS = 10_000;
export const CSV_MAX_CELL_LENGTH = 10_000;
export const CSV_MAX_COLUMNS = 1_000;
export const CSV_MALFORMED_REASONS = [
  "unterminated_quote",
  "text_after_closing_quote",
  "column_count_mismatch",
  "empty_row",
] as const;

export type CsvMalformedReason = (typeof CSV_MALFORMED_REASONS)[number];

export interface CsvRecordRow {
  /** 1-based ordinal among physical data records, counting malformed records too. */
  rowNumber: number;
  /** 1-based physical source line on which the record starts. */
  line: number;
  cells: string[];
}

export interface CsvMalformedRow {
  /** 1-based data record ordinal; 0 means the header record itself was malformed. */
  rowNumber: number;
  line: number;
  reason: CsvMalformedReason;
  /**
   * Cells as tokenised. A cell with text after its closing quote keeps its literal source text,
   * quotes included, so nothing is silently rewritten.
   */
  cells: string[];
}

export interface CsvRecords {
  header: string[];
  rows: CsvRecordRow[];
  malformed: CsvMalformedRow[];
}

export interface CsvLimits {
  maxRows?: number;
  maxCellLength?: number;
  maxColumns?: number;
}
