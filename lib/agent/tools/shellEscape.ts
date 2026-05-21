/**
 * Escape a string for safe use as a single-quoted shell argument.
 *
 * Wraps the string in single quotes and escapes any embedded single
 * quotes via the standard `' → '\''` dance (close quote, escape literal
 * quote, reopen quote). Everything else stays verbatim inside single
 * quotes — shell metacharacters like `$`, `` ` ``, `&`, `*` are NOT
 * expanded so the result is safe to pass to `bash -c` or `sh -c`.
 *
 * @param s - The string to escape.
 */
export function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}
