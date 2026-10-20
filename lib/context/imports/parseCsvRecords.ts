import { ContextImportError } from "./ContextImportError";
import {
  CSV_MAX_CELL_LENGTH,
  CSV_MAX_COLUMNS,
  CSV_MAX_ROWS,
  type CsvLimits,
  type CsvMalformedReason,
  type CsvRecords,
} from "./csvRecordTypes";
import { findClosingQuote } from "./findClosingQuote";

/**
 * Tokenizes RFC 4180 CSV text into a header and physical data records.
 *
 * Quoted fields, doubled quotes, CRLF/LF terminators, embedded newlines and a leading byte-order
 * mark are handled. Cells are returned verbatim (untrimmed). Records that are blank, that do not
 * match the header column count, that never close a quote, or that have text after a closing
 * quote are reported in `malformed` with their pointers instead of being dropped or repaired; a
 * cell with text after its closing quote keeps its literal source text. Blank lines after the
 * last record are not records. Exceeding the row, column or cell caps throws a
 * `ContextImportError`; no partial result is returned. A quote that nothing in the rest of the
 * input can close is reported as `unterminated_quote` at its starting line, whatever its length.
 *
 * @param text - CSV text that has already been decoded as UTF-8.
 * @param limits - Optional overrides for the row, column and cell caps.
 * @returns Header cells, well-formed rows and malformed records with row/line pointers.
 */
export function parseCsvRecords(text: string, limits: CsvLimits = {}): CsvRecords {
  const maxRows = limits.maxRows ?? CSV_MAX_ROWS;
  const maxCellLength = limits.maxCellLength ?? CSV_MAX_CELL_LENGTH;
  const maxColumns = limits.maxColumns ?? CSV_MAX_COLUMNS;
  const input = text.startsWith("﻿") ? text.slice(1) : text;
  const result: CsvRecords = { header: [], rows: [], malformed: [] };

  let headerSeen = false;
  let dataRecords = 0;
  let pendingBlankLines: number[] = [];
  let cells: string[] = [];
  let cell = "";
  let cellStart = 0;
  let cellLine = 1;
  let line = 1;
  let recordStart = 0;
  let recordLine = 1;
  let recordReason: CsvMalformedReason | undefined;
  let inQuotes = false;
  let afterQuote = false;

  const pushCell = (): void => {
    cells.push(cell);
    cell = "";
    if (cells.length > maxColumns)
      throw new ContextImportError(
        "column_limit_exceeded",
        `CSV record on line ${recordLine} exceeds the ${maxColumns} column limit`,
      );
  };

  /** Returns true when an unclosable quote has consumed the rest of the input. */
  const checkCell = (next: number): boolean => {
    if (cell.length <= maxCellLength) return false;
    if (inQuotes && findClosingQuote(input, next) === -1) {
      cell += input.slice(next);
      return true;
    }
    throw new ContextImportError(
      "cell_limit_exceeded",
      `CSV cell starting on line ${cellLine} exceeds the ${maxCellLength} character limit`,
    );
  };

  const addDataRecord = (record: string[], startLine: number, reason?: CsvMalformedReason) => {
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
        line: startLine,
        reason: malformedReason,
        cells: record,
      });
    else result.rows.push({ rowNumber: dataRecords, line: startLine, cells: record });
  };

  const finalizeRecord = (reason?: CsvMalformedReason, blankLine = false): void => {
    const record = cells;
    const recordMalformedReason = reason ?? recordReason;
    cells = [];
    recordReason = undefined;
    if (!headerSeen) {
      headerSeen = true;
      if (recordMalformedReason)
        result.malformed.push({
          rowNumber: 0,
          line: recordLine,
          reason: recordMalformedReason,
          cells: record,
        });
      else result.header = record;
      return;
    }
    // A blank line only becomes an `empty_row` once a later record proves it is not trailing.
    if (blankLine && !recordMalformedReason) {
      pendingBlankLines.push(recordLine);
      return;
    }
    for (const blank of pendingBlankLines) addDataRecord([""], blank, "empty_row");
    pendingBlankLines = [];
    addDataRecord(record, recordLine, recordMalformedReason);
  };

  let i = 0;
  while (i < input.length) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"' && input[i + 1] !== '"') {
        inQuotes = false;
        afterQuote = true;
        i += 1;
        continue;
      }
      const width = char === '"' || (char === "\r" && input[i + 1] === "\n") ? 2 : 1;
      cell += char === '"' ? '"' : input.slice(i, i + width);
      if (char === "\r" || char === "\n") line += 1;
      i += width;
      if (checkCell(i)) break;
      continue;
    }
    if (char === "," || char === "\r" || char === "\n") {
      const width = char === "\r" && input[i + 1] === "\n" ? 2 : 1;
      pushCell();
      afterQuote = false;
      if (char !== ",") {
        finalizeRecord(undefined, i === recordStart);
        line += 1;
        recordLine = line;
        recordStart = i + width;
      }
      i += width;
      cellStart = i;
      cellLine = line;
      continue;
    }
    if (afterQuote) {
      // Not valid CSV: keep the literal source text of the cell and flag the whole record.
      cell = input.slice(cellStart, i);
      recordReason ??= "text_after_closing_quote";
      afterQuote = false;
    } else if (char === '"' && i === cellStart) {
      inQuotes = true;
      i += 1;
      continue;
    }
    cell += char;
    i += 1;
    checkCell(i);
  }

  if (inQuotes) {
    pushCell();
    finalizeRecord("unterminated_quote");
  } else if (input.length > recordStart) {
    pushCell();
    finalizeRecord();
  }

  return result;
}
