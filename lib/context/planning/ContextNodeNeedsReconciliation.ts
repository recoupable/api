/** A previous provider call may have started. Reconcile saved evidence before any retry. */
export class ContextNodeNeedsReconciliation extends Error {
  constructor() {
    super("Context node requires reconciliation before another provider call");
    this.name = "ContextNodeNeedsReconciliation";
  }
}
