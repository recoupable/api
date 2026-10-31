/** A classified identity failure without provider details or credentials. */
export class OAuthIdentityError extends Error {
  constructor(readonly reason: "invalid_token" | "unavailable") {
    super("Unable to verify OAuth identity");
  }
}
