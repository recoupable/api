/**
 * Thrown when the requested action slug is not available for the
 * account's catalog (customer + artist + shared). The handler maps this
 * to a 404 response.
 */
export class ConnectorActionNotFoundError extends Error {
  constructor(slug: string) {
    super(`Connector action not found: ${slug}`);
    this.name = "ConnectorActionNotFoundError";
  }
}
