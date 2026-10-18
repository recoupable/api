import { findValue } from "@/lib/publishing/findValue";

/**
 * The post's text as X stores it, minus the trailing media link X appends and
 * with its HTML entities decoded.
 *
 * @param lookup - TWITTER_POST_LOOKUP_BY_POST_ID result.
 * @returns The comparable text, or null.
 */
export function liveXText(lookup: unknown): string | null {
  const text = findValue(lookup, ["text"]);
  if (text === null) return null;
  return text
    .replace(/\s*https:\/\/t\.co\/\w+$/, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
