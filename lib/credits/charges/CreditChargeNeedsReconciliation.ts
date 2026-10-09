/** The debit may have committed. Preserve the key and reconcile; never repeat paid work. */
export class CreditChargeNeedsReconciliation extends Error {
  constructor(cause?: unknown) {
    super("Credit charge needs reconciliation; retain the same operation key", { cause });
    this.name = "CreditChargeNeedsReconciliation";
  }
}
