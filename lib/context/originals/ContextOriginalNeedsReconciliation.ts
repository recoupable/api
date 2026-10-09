/** Internal recovery identity; do not serialize causes or workspace identifiers to clients. */
export class ContextOriginalNeedsReconciliation extends Error {
  constructor(
    readonly ownerId: string,
    readonly sourceId: string,
    readonly idempotencyKey: string,
    cause: unknown,
  ) {
    super("Original save needs reconciliation", { cause });
    for (const field of ["ownerId", "sourceId", "idempotencyKey"])
      Object.defineProperty(this, field, {
        enumerable: false,
        writable: false,
        configurable: false,
      });
    this.name = "ContextOriginalNeedsReconciliation";
  }
}
