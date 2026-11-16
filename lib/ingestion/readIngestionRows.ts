import { parse as csv } from "csv-parse/sync";
import { parse as json } from "lossless-json";
import { z } from "zod";
import type { IngestionContract, IngestionFormat, SourceRow, Values } from "./types";
import { INGESTION_MAX_BYTES, INGESTION_MAX_ROWS, INGESTION_MAX_COLUMNS } from "./const";
import { readIngestionWorkbook } from "./readIngestionWorkbook";
import { readIngestionPdf } from "./readIngestionPdf";

/** Read bounded native source records without numeric inference. */
export async function readIngestionRows(
  bytes: Uint8Array,
  format: IngestionFormat,
  contract: IngestionContract,
): Promise<SourceRow[]> {
  if (!bytes.length || bytes.length > INGESTION_MAX_BYTES) throw new Error("FILE_SIZE_INVALID");
  if (format === "xlsx") return readIngestionWorkbook(bytes, contract);
  if (format === "pdf") return readIngestionPdf(bytes, contract);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  if (format === "csv" || format === "tsv") {
    const rows = z
      .array(
        z.object({
          record: z.array(z.string()).max(INGESTION_MAX_COLUMNS),
          info: z.object({ lines: z.number().int().positive() }),
        }),
      )
      .max(INGESTION_MAX_ROWS + 1000)
      .parse(
        csv(text, {
          delimiter: format === "tsv" ? "\t" : contract.delimiter,
          bom: true,
          skip_empty_lines: true,
          max_record_size: 100000,
          info: true,
          relax_column_count: true,
        }),
      );
    const startLine = (r: (typeof rows)[number]) =>
      r.info.lines - r.record.reduce((n, v) => n + (v.match(/\r\n|\r|\n/g)?.length ?? 0), 0);
    const headerIndex = rows.findIndex(r => startLine(r) === contract.header_row);
    const header = rows[headerIndex]?.record;
    if (
      !header?.length ||
      header.length > INGESTION_MAX_COLUMNS ||
      header.some(s => !s) ||
      new Set(header).size !== header.length
    )
      throw new Error("HEADER_INVALID");
    if (rows.length - headerIndex - 1 > INGESTION_MAX_ROWS) throw new Error("ROW_LIMIT");
    return rows.slice(headerIndex + 1).map(({ record: cells, info }) => {
      if (cells.length !== header.length) throw new Error("ROW_WIDTH_INVALID");
      if (cells.every((v, i) => v === header[i])) throw new Error("REPEATED_HEADER");
      return {
        source_row:
          info.lines - cells.reduce((n, cell) => n + (cell.match(/\r\n|\r|\n/g)?.length ?? 0), 0),
        values: Object.fromEntries(header.map((name, c) => [name, cells[c]])),
      };
    });
  }
  const jsonLines = text
    .split(/\r?\n/)
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => line.trim());
  const parsed: unknown =
    format === "jsonl"
      ? jsonLines.map(({ line }) => json(line, undefined, n => n))
      : json(text, undefined, n => n);
  let selected: unknown = parsed;
  for (const part of contract.records_path) {
    if (!selected || typeof selected !== "object" || !Object.hasOwn(selected, part))
      throw new Error("RECORDS_PATH_INVALID");
    selected = (selected as Record<string, unknown>)[part];
  }
  if (!Array.isArray(selected) || selected.length > INGESTION_MAX_ROWS)
    throw new Error("RECORDS_INVALID");
  return selected.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("RECORD_INVALID");
    if (Object.keys(item).length > INGESTION_MAX_COLUMNS) throw new Error("COLUMN_LIMIT");
    const values: Values = Object.create(null);
    for (const [key, value] of Object.entries(item)) {
      if (value !== null && !["string", "boolean"].includes(typeof value))
        throw new Error("NESTED_VALUE_UNSUPPORTED");
      values[key] = value === null ? null : String(value);
    }
    return { source_row: format === "jsonl" ? jsonLines[index].number : index + 1, values };
  });
}
