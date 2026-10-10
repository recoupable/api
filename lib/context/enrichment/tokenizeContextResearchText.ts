/** NFKC-normalized, lower-cased word tokens. Untrusted text is only split, never interpreted or used as a pattern. */
export function tokenizeContextResearchText(text: string): string[] {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .normalize("NFKC")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}
