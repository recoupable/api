/** A storage boundary failed; deliberately carries no backend error or cause. */
export class OAuthStorageUnavailableError extends Error {
  constructor() {
    super("OAuth storage unavailable");
  }
}
