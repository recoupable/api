/** The provider answered, but its structured output failed validation. The attempt fails; nothing partial is accepted. */
export class ContextStructuredOutputInvalid extends Error {
  readonly reason: string;
  readonly rawLength: number;

  /**
   * Create the error from a parse result. The raw provider text is deliberately not attached.
   *
   * @param reason - Why validation rejected the output.
   * @param rawLength - Length of the raw provider response, for diagnostics without the content.
   */
  constructor(reason: string, rawLength: number) {
    super(`Music Flamingo structured output is invalid: ${reason}`);
    this.name = "ContextStructuredOutputInvalid";
    this.reason = reason;
    this.rawLength = rawLength;
  }
}
