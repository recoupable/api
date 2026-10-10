import { ContextImportError } from "./contextImportError";

export const CSV_MAX_ROWS = 10_000;
export const CSV_MAX_CELL_LENGTH = 10_000;
export const CSV_MALFORMED_REASONS = [
  "unterminated_quote",
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
}

/**
 * Tokenizes RFC 4180 CSV text into a header and physical data records.
 *
 * Quoted fields, doubled quotes, CRLF/LF terminators, embedded newlines and a leading byte-order
 * mark are handled. Cells are returned verbatim (untrimmed). Records that are blank, that do not
 * match the header column count, or that never close a quote are reported in `malformed` with
 * their pointers instead of being dropped or repaired. Exceeding the row or cell caps throws a
 * `ContextImportError`; no partial result is returned.
 *
 * @param text - CSV text that has already been decoded as UTF-8.
 * @param limits - Optional overrides for the row and cell caps (defaults are the exported constants).
 * @returns Header cells, well-formed rows and malformed records with row/line pointers.
 */
export function parseCsvRecords(text: string, limits: CsvLimits = {}): CsvRecords {
  const maxRows = limits.maxRows ?? CSV_MAX_ROWS;
  const maxCellLength = limits.maxCellLength ?? CSV_MAX_CELL_LENGTH;
  const input = text.startsWith("﻿") ? text.slice(1) : text;
  const result: CsvRecords = { header: [], rows: [], malformed: [] };

  let headerSeen = false;
  let dataRecords = 0;
  let cells: string[] = [];
  let cell = "";
  let line = 1;
  let recordLine = 1;
  let recordStarted = false;
  let inQuotes = false;

  const checkCell = (): void => {
    if (cell.length > maxCellLength)
      throw new ContextImportError(
        "cell_limit_exceeded",
        `CSV cell on line ${line} exceeds the ${maxCellLength} character limit`,
      );
  };

  const finalizeRecord = (reason?: CsvMalformedReason): void => {
    const record = cells;
    cells = [];
    if (!headerSeen) {
      headerSeen = true;
      if (reason) result.malformed.push({ rowNumber: 0, line: recordLine, reason, cells: record });
      else result.header = record;
      return;
    }
    dataRecords += 1;
    if (dataRecords > maxRows)
      throw new ContextImportError(
        "row_limit_exceeded",
        `CSV exceeds the ${maxRows} data row limit; nothing was imported`,
      );
    const malformedReason =
      reason ??
      (record.every(value => value.trim() === "")
        ? "empty_row"
        : record.length !== result.header.length
          ? "column_count_mismatch"
          : undefined);
    if (malformedReason)
      result.malformed.push({
        rowNumber: dataRecords,
        line: recordLine,
        reason: malformedReason,
        cells: record,
      });
    else result.rows.push({ rowNumber: dataRecords, line: recordLine, cells: record });
  };

  let i = 0;
  while (i < input.length) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 2;
          checkCell();
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      if (char === "\r" && input[i + 1] === "\n") {
        cell += "\r\n";
        line += 1;
        i += 2;
        checkCell();
        continue;
      }
      if (char === "\r" || char === "\n") line += 1;
      cell += char;
      i += 1;
      checkCell();
      continue;
    }
    recordStarted = true;
    if (char === '"' && cell.length === 0) {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      cells.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (char === "\r" || char === "\n") {
      const width = char === "\r" && input[i + 1] === "\n" ? 2 : 1;
      cells.push(cell);
      cell = "";
      finalizeRecord();
      i += width;
      line += 1;
      recordLine = line;
      recordStarted = false;
      continue;
    }
    cell += char;
    i += 1;
    checkCell();
  }

  if (inQuotes) {
    cells.push(cell);
    finalizeRecord("unterminated_quote");
  } else if (recordStarted) {
    cells.push(cell);
    finalizeRecord();
  }

  return result;
}
