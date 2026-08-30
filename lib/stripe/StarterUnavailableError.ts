/** Thrown when a Starter checkout is requested but `STRIPE_STARTER_PRICE_ID` is unset. */
export class StarterUnavailableError extends Error {
  constructor() {
    super("starter_unavailable");
    this.name = "StarterUnavailableError";
  }
}
