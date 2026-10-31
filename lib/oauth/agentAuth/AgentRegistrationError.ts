/** Public protocol errors carry no identity, credential, or backend diagnostics. */
export class AgentRegistrationError extends Error {
  constructor(
    readonly error: string,
    readonly status = 400,
  ) {
    super(error);
  }
}
