/** A previous provider call may have started. Reconcile saved evidence before any retry. */
export class ContextNodeNeedsReconciliation extends Error {
  constructor(cause?: unknown) {
    super("Context node requires reconciliation before another provider call", { cause });
    this.name = "ContextNodeNeedsReconciliation";
  }
}
