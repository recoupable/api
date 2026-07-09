/** Truncates to `max` characters with a trailing ellipsis. */
export function truncateText(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
