/**
 * Resolves primary-catalog mode from camelCase or snake_case query params.
 * Empty values are ignored so defaults are not forwarded as blank strings.
 */
export function resolveCatalogPrimary(query?: Record<string, string>): string {
  const camel = query?.isPrimary?.trim();
  if (camel) return camel;

  const snake = query?.is_primary?.trim();
  if (snake) return snake;

  return "true";
}
