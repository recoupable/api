// X's counting rules (twitter-text v3): any URL, with or without a scheme,
// counts as 23; an emoji sequence counts as 2; code points in the ranges below
// count as 1; everything else (e.g. CJK) counts as 2. Trailing punctuation
// after a URL is not part of it.
const URL_PATTERN = /(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*[^\s.,!?;:)'"])?/gi;
const URL_WEIGHT = 23;
const SINGLE_WEIGHT_RANGES: Array<[number, number]> = [
  [0, 4351],
  [8192, 8205],
  [8208, 8223],
  [8242, 8247],
];
const EMOJI = /\p{Extended_Pictographic}/u;

/**
 * Length of a post's text as X counts it against its 280 limit.
 *
 * Mirrors twitter-text's weighted counting closely enough to reject over-long
 * copy at create time rather than at publish time. It errs long, never short:
 * a bare domain counts as a full URL, as X auto-links it.
 *
 * @param text - Post text.
 * @returns The weighted length.
 */
export function countXWeightedLength(text: string): number {
  const urls = text.match(URL_PATTERN) ?? [];
  const rest = text.replace(URL_PATTERN, "");
  let length = urls.length * URL_WEIGHT;

  for (const { segment } of new Intl.Segmenter().segment(rest)) {
    if (EMOJI.test(segment)) {
      length += 2;
      continue;
    }
    for (const char of segment) {
      const code = char.codePointAt(0) ?? 0;
      length += SINGLE_WEIGHT_RANGES.some(([low, high]) => code >= low && code <= high) ? 1 : 2;
    }
  }

  return length;
}
