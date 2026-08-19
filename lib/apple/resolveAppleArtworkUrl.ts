// 296px square: crisp at 2x on the profile page's largest artwork tile while
// staying a small thumbnail payload.
const DEFAULT_ARTWORK_SIZE_PX = 296;

/**
 * Resolve Apple Music's artwork URL template into a directly fetchable URL.
 * Apple returns artwork as `.../{w}x{h}bb.jpg`, leaving the dimensions to the
 * consumer; a URL with the literal placeholders 404s.
 *
 * @param templateUrl - Apple's artwork URL, with or without `{w}`/`{h}` placeholders.
 * @param sizePx - Square dimension to request (default 296).
 * @returns The URL with concrete dimensions.
 */
export function resolveAppleArtworkUrl(
  templateUrl: string,
  sizePx: number = DEFAULT_ARTWORK_SIZE_PX,
): string {
  return templateUrl.replace("{w}", String(sizePx)).replace("{h}", String(sizePx));
}
