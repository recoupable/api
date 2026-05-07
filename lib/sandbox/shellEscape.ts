/**
 * Wraps a string for safe inclusion as a single argument in a shell
 * command. Uses POSIX single-quote escaping: every embedded apostrophe
 * is closed, escaped, then re-opened (`'` → `'\''`). Spaces, env-var
 * expansions, redirections, and other shell metacharacters are
 * preserved verbatim within the quotes.
 *
 * @param value - The raw string to escape.
 * @returns A shell-safe quoted version of `value`.
 */
export function shellEscape(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
