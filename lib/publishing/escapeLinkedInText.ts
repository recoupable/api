/**
 * Escape post text into LinkedIn's "little text" commentary format.
 *
 * Reserved characters are backslash-escaped and hashtags become hashtag
 * templates; unescaped, LinkedIn truncates the post at the first reserved
 * character.
 *
 * @param text - Plain post text.
 * @returns The commentary string to send.
 */
export function escapeLinkedInText(text: string): string {
  const escaped = text.replace(/([\\|{}@[\]()<>*_~])/g, "\\$1");
  return escaped.replace(/#(\w+)/g, (_, tag: string) => `{hashtag|\\#|${tag}}`);
}
