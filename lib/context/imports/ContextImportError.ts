export const CONTEXT_IMPORT_ERROR_CODES = [
  "unsupported_input",
  "empty_input",
  "header_missing",
  "row_limit_exceeded",
  "column_limit_exceeded",
  "cell_limit_exceeded",
] as const;

export type ContextImportErrorCode = (typeof CONTEXT_IMPORT_ERROR_CODES)[number];

/**
 * Explicit, whole-input failure of a Context import parser.
 *
 * A thrown error means no proposals were produced at all; the parser never returns a silently
 * truncated or partially imported result. Malformed individual rows are not errors: they are
 * reported inside a successful result so the original stays available for later work.
 */
export class ContextImportError extends Error {
  readonly code: ContextImportErrorCode;

  constructor(code: ContextImportErrorCode, message: string) {
    super(message);
    this.name = "ContextImportError";
    this.code = code;
  }
}
