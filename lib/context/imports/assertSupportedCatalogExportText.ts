import { ContextImportError } from "./contextImportError";

const PDF_HEADER = "%PDF-";
const ZIP_HEADER = "PK\u0003\u0004";

const isBinaryCharacter = (code: number): boolean =>
  (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) ||
  code === 0x7f ||
  code === 0xfffd;

/**
 * Rejects input that is not plain UTF-8 text CSV before any tokenising happens.
 *
 * PDF documents, zip containers (XLSX and friends) and text with control characters or U+FFFD
 * replacement characters are refused with `unsupported_input` so they never yield a proposals
 * list. Tabs, line feeds and carriage returns are allowed.
 *
 * @param text - Candidate catalog export text.
 */
export function assertSupportedCatalogExportText(text: string): void {
  if (text.startsWith(PDF_HEADER))
    throw new ContextImportError(
      "unsupported_input",
      "PDF documents are not parsed by the catalog export CSV parser",
    );
  if (text.startsWith(ZIP_HEADER))
    throw new ContextImportError(
      "unsupported_input",
      "Zip containers such as XLSX are not parsed by the catalog export CSV parser",
    );
  for (let i = 0; i < text.length; i += 1)
    if (isBinaryCharacter(text.charCodeAt(i)))
      throw new ContextImportError(
        "unsupported_input",
        "Input contains control or replacement characters; only UTF-8 text CSV is supported",
      );
}
