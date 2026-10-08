/** Public, retry-safe onboarding failures with an HTTP status for REST callers. */
export class ArtistOnboardingError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ArtistOnboardingError";
  }
}
