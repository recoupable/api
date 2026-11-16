import { unzipSync } from "fflate";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { IngestionContract, SourceRow } from "./types";
import { INGESTION_MAX_ROWS, INGESTION_MAX_COLUMNS, INGESTION_MAX_ARTIFACT_BYTES } from "./const";

/** Read one explicitly selected XLSX sheet; retain native number tokens and reject formulas. */
export function readIngestionWorkbook(bytes: Uint8Array, contract: IngestionContract): SourceRow[] {
  let expanded = 0;
  let members = 0;
  const seen = new Set<string>();
  const files = unzipSync(bytes, {
    filter: file => {
      expanded += file.originalSize;
      if (
        ++members > 1000 ||
        expanded > INGESTION_MAX_ARTIFACT_BYTES ||
        seen.has(file.name) ||
        file.name.split("/").includes("..")
      )
        throw new Error("WORKBOOK_LIMIT");
      seen.add(file.name);
      return file.name.endsWith(".xml") || file.name.endsWith(".rels");
    },
  });
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
    textNodeName: "#text",
  });
  const parse = (path: string): unknown => {
    if (!files[path]) throw new Error("WORKBOOK_INVALID");
    const text = new TextDecoder("utf-8", { fatal: true }).decode(files[path]);
    if (/<!DOCTYPE|<!ENTITY/i.test(text) || XMLValidator.validate(text) !== true)
      throw new Error("WORKBOOK_INVALID");
    return parser.parse(text);
  };
  const array = <T>(v: T | T[] | undefined): T[] =>
    v === undefined ? [] : Array.isArray(v) ? v : [v];
  interface Sheet {
    "@_name": string;
    "@_r:id": string;
  }
  interface Relationship {
    "@_Id": string;
    "@_Target": string;
    "@_TargetMode"?: string;
  }
  interface Cell {
    "@_r": string;
    "@_t"?: string;
    v?: string;
    is?: unknown;
    f?: unknown;
  }
  interface Row {
    "@_r": string;
    c?: Cell | Cell[];
  }
  const workbook = parse("xl/workbook.xml") as {
    workbook?: { sheets?: { sheet?: Sheet | Sheet[] } };
  };
  const sheets = array(workbook.workbook?.sheets?.sheet);
  if (!contract.sheet && sheets.length !== 1) throw new Error("SHEET_SELECTION_REQUIRED");
  const sheet = contract.sheet ? sheets.find(s => s["@_name"] === contract.sheet) : sheets[0];
  if (!sheet) throw new Error("SHEET_NOT_FOUND");
  const relationships = parse("xl/_rels/workbook.xml.rels") as {
    Relationships?: { Relationship?: Relationship | Relationship[] };
  };
  const rel = array(relationships.Relationships?.Relationship).find(
    r => r["@_Id"] === sheet["@_r:id"],
  );
  if (!rel || rel["@_TargetMode"] === "External") throw new Error("WORKBOOK_INVALID");
  const target = rel["@_Target"];
  if (
    typeof target !== "string" ||
    target.includes("..") ||
    !/^(?:\/xl\/)?(?:worksheets\/)?[A-Za-z0-9_./-]+\.xml$/.test(target)
  )
    throw new Error("WORKBOOK_INVALID");
  const path = target.startsWith("/xl/") ? target.slice(1) : `xl/${target}`;
  const textOf = (v: unknown): string => {
    if (typeof v === "string") return v;
    if (!v || typeof v !== "object" || Array.isArray(v)) return "";
    const node = v as Record<string, unknown>;
    if (node.t !== undefined) return textOf(node.t);
    if (node["#text"] !== undefined) return String(node["#text"]);
    return array(node.r)
      .map(r => textOf((r as Record<string, unknown>).t))
      .join("");
  };
  const shared = files["xl/sharedStrings.xml"]
    ? (parse("xl/sharedStrings.xml") as { sst?: { si?: unknown[] } })
    : undefined;
  const strings = array(shared?.sst?.si).map(textOf);
  const worksheet = parse(path) as { worksheet?: { sheetData?: { row?: Row | Row[] } } };
  const rows = array(worksheet.worksheet?.sheetData?.row);
  if (rows.length > INGESTION_MAX_ROWS + 1000) throw new Error("ROW_LIMIT");
  let header: string[] | undefined;
  const output: SourceRow[] = [];
  const rowNumbers = new Set<number>();
  for (const row of rows) {
    const number = Number(row["@_r"]);
    if (!Number.isSafeInteger(number) || number < 1 || number > 1048576 || rowNumbers.has(number))
      throw new Error("ROW_INVALID");
    rowNumbers.add(number);
    const cells: string[] = [];
    const positions = new Set<number>();
    for (const cell of array(row.c)) {
      const match = /^([A-Z]+)(\d+)$/.exec(cell["@_r"] ?? "");
      if (!match || Number(match[2]) !== number || Object.hasOwn(cell, "f"))
        throw new Error("FORMULA_OR_CELL_INVALID");
      const column = [...match[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      if (column >= INGESTION_MAX_COLUMNS || positions.has(column)) throw new Error("COLUMN_LIMIT");
      positions.add(column);
      const type = cell["@_t"];
      if (type && !["s", "inlineStr", "str", "n", "b", "d"].includes(type))
        throw new Error("CELL_TYPE_UNSUPPORTED");
      let value = type === "inlineStr" ? textOf(cell.is) : String(cell.v ?? "");
      if (type === "s") {
        if (!/^\d+$/.test(value) || strings[Number(value)] === undefined)
          throw new Error("SHARED_STRING_INVALID");
        value = strings[Number(value)];
      }
      if (type === "b") {
        if (!["0", "1"].includes(value)) throw new Error("CELL_TYPE_UNSUPPORTED");
        value = value === "1" ? "true" : "false";
      }
      cells[column] = value;
    }
    if (number < contract.header_row) continue;
    if (number === contract.header_row) {
      header = Array.from({ length: cells.length }, (_, i) => cells[i] ?? "");
      if (!header.length || header.some(n => !n) || new Set(header).size !== header.length)
        throw new Error("HEADER_INVALID");
      continue;
    }
    if (!header || cells.slice(header.length).some(v => v !== ""))
      throw new Error("ROW_WIDTH_INVALID");
    if (!cells.some(v => v !== "")) continue;
    output.push({
      source_row: number,
      source_sheet: sheet["@_name"],
      values: Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""])),
    });
  }
  if (!header) throw new Error("HEADER_INVALID");
  if (output.length > INGESTION_MAX_ROWS) throw new Error("ROW_LIMIT");
  return output;
}
