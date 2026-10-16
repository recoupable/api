import { ContextImportError } from "./ContextImportError";

const PDF_HEADER = "%PDF-";
const ZIP_HEADER = "PK\u0003\u0004";

const isControlOrReplacement = (code: number): boolean =>
  (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) ||
  (code >= 0x7f && code <= 0x9f) ||
  code === 0xfffd;

const isHighSurrogate = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number): boolean => code >= 0xdc00 && code <= 0xdfff;

/**
 * Rejects input that is detectably not plain UTF-8 text CSV before any tokenising happens.
 *
 * PDF documents and zip containers (XLSX and friends), with or without a leading byte-order mark,
 * and text with C0/C1 control characters, U+FFFD replacement characters or unpaired UTF-16
 * surrogates are refused with `unsupported_input` so they never yield a proposals list. Tabs, line
 * feeds and carriage returns are allowed. Other formats or source encodings that decode to
 * ordinary text are not detected here; callers must exclude them before calling the parser.
 *
 * @param text - Candidate catalog export text.
 */
export function assertSupportedCatalogExportText(text: string): void {
  const body = text.startsWith("﻿") ? text.slice(1) : text;
  if (body.startsWith(PDF_HEADER))
    throw new ContextImportError(
      "unsupported_input",
      "PDF documents are not parsed by the catalog export CSV parser",
    );
  if (body.startsWith(ZIP_HEADER))
    throw new ContextImportError(
      "unsupported_input",
      "Zip containers such as XLSX are not parsed by the catalog export CSV parser",
    );
  for (let i = 0; i < body.length; i += 1) {
    const code = body.charCodeAt(i);
    if (isHighSurrogate(code) && isLowSurrogate(body.charCodeAt(i + 1))) {
      i += 1;
      continue;
    }
    if (isControlOrReplacement(code) || isHighSurrogate(code) || isLowSurrogate(code))
      throw new ContextImportError(
        "unsupported_input",
        "Input contains control, replacement or unpaired surrogate characters; only UTF-8 text CSV is supported",
      );
  }
}
