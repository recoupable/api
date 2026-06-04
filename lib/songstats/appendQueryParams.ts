/**
 * Appends non-empty query params to a URL's search params in place.
 */
export function appendQueryParams(url: URL, queryParams?: Record<string, string>): void {
  if (!queryParams) return;

  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, value);
    }
  }
}
