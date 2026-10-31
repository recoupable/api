/** Compare UUID values independently of their accepted textual casing. */
export function sameCatalogUuid(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}
