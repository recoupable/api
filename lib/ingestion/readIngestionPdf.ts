import type { IngestionContract, SourceRow } from "./types";
import { INGESTION_MAX_ROWS, INGESTION_MAX_COLUMNS } from "./const";

/** Extract a reviewed, literal-separator PDF layout. Scans and ambiguous layouts stay rejected. */
export async function readIngestionPdf(
  bytes: Uint8Array,
  contract: IngestionContract,
): Promise<SourceRow[]> {
  if (!contract.text_table) throw new Error("PDF_LAYOUT_REQUIRED");
  if (Buffer.from(bytes.subarray(0, 5)).toString() !== "%PDF-")
    throw new Error("PDF_SIGNATURE_INVALID");
  const { getDocumentProxy, extractText } = await import("unpdf");
  const document = await getDocumentProxy(new Uint8Array(bytes), {
    useWorkerFetch: false,
  });
  try {
    if (document.numPages > 50) throw new Error("PDF_PAGE_LIMIT");
    const result = await extractText(document, { mergePages: false });
    if (result.text.length !== document.numPages || result.text.some(page => !page.trim()))
      throw new Error("OCR_REQUIRED");
    if (result.text.reduce((n, page) => n + page.length, 0) > 2000000)
      throw new Error("PDF_TEXT_LIMIT");
    let header: string[] | undefined;
    let count = 0;
    const records: SourceRow[] = [];
    for (const [page, text] of result.text.entries()) {
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue;
        ++count;
        if (count < contract.header_row) continue;
        const cells = line.split(contract.text_table.separator);
        if (!header) {
          header = cells;
          if (
            header.length > INGESTION_MAX_COLUMNS ||
            header.some(n => !n) ||
            new Set(header).size !== header.length
          )
            throw new Error("HEADER_INVALID");
        } else {
          if (cells.length !== header.length) throw new Error("PDF_ROW_INVALID");
          if (records.length >= INGESTION_MAX_ROWS) throw new Error("ROW_LIMIT");
          if (cells.every((v, i) => v === header![i])) throw new Error("REPEATED_HEADER");
          records.push({
            source_row: count,
            source_page: page + 1,
            values: Object.fromEntries(header.map((h, i) => [h, cells[i]])),
          });
        }
      }
    }
    return records;
  } finally {
    await document.loadingTask.destroy();
  }
}
