# Credit reservations

`reserveCreditsOnce`, `settleCreditReservation` and `releaseCreditReservation` in
`lib/supabase/credit_reservations` are opt-in adapters to the database
reservation functions (`20261010210500_credit_reservations.sql`). They are the
shared AI-accounting primitive for app#2105 milestone 1, reused by Context
accounting (app#2123). They have no production callers and enable no Sites or
Context spending.

## Wallet invariant

Confirmed balance is `credits_usage.remaining_credits`. Outstanding holds are the
owner's unsettled reservations. Spendable is confirmed balance minus outstanding holds.
A hold is a claim, not a temporary debit, so the monthly refill, top-ups and
auto-top-up never see it as consumption.

## Flow

1. The trusted server resolves and authorizes the billing owner and chooses one
   stable operation key for the chargeable attempt.
2. `reserveCreditsOnce` holds the estimated maximum. `insufficient` is a definite
   denial and holds nothing, so the caller can return a machine-readable 402. Paid work
   starts only on a hold whose status is `held` (a `reused` receipt reports `held`,
   `settled` or `released`).
3. After the work, `settleCreditReservation` charges the actual credits (at most the
   hold) through the same owner/key receipt as `recordCreditChargeOnce`, then the
   remainder stops being held. Use the existing pricing rules for the amount.
4. `releaseCreditReservation` closes a hold with no charge, for work known not to
   have incurred one (for example, cancelled before dispatch).

Every RPC failure, lost response or invalid receipt throws a reconciliation error
(`CreditReservationNeedsReconciliation` for holds and releases,
`CreditChargeNeedsReconciliation` for settlement, which may have committed). Keep the
same key and replay the same call to learn the state. The adapters never retry, mint a
fresh key, call providers or trigger auto-top-up. `settleCreditReservation` does not
call `maybeAutoTopUp`; a future caller must decide that explicitly.

## Not covered yet

- Legacy debit writers (`recordCreditDeduction`, `deductCredits`, the
  `deduct_credits*` RPCs) do not consult holds, so spendable can go negative while a
  hold is outstanding. Sites production assets, research, content and x402 still use
  `deductCredits`.
- No hold expiry. Unknown provider exposure stays held until reconciled.
- No request/pilot ceilings, pricing version, provider-expense versus customer-debit
  report, or approved failure/cancellation billing policy.
- Existing preflight (`checkCreditsAvailable`) still reads the confirmed balance, not
  spendable credit.

Apply and verify the database migration through the database release process before
connecting a caller. Generated client types will follow that release; each adapter
narrowly types its single RPC at the access-layer boundary. Mocked adapter tests do not
prove production charging or authorization.
