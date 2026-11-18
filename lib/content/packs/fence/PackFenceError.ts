/** An uncertain/refused durable write must not trigger fallback finish, settle or paid retry. */
export class PackFenceError extends Error {
  constructor(message = "Protocol-2 persistence requires reconciliation") {
    super(message);
    this.name = "PackFenceError";
  }
}
