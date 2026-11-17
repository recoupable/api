# Credit reservations

`reserveCreditsOnce`, `settleCreditReservation` and `releaseCreditReservation` in
`lib/supabase/credit_reservations` are opt-in adapters to the database
reservation functions (`20261010210500_credit_reservations.sql`) and their additive
wallet composition guard (`20261117000000_compose_credit_reservations.sql`). They are the
shared AI-accounting primitive for app#2105 milestone 1, reused by Context
accounting (app#2123). They have no production callers and enable no Sites or
Context spending.

## Wallet invariant

The wallet balance is `credits_usage.remaining_credits`. Existing release-pack holds
have already been deducted from it. Shared outstanding holds are the owner's unsettled
`credit_reservations` rows, which have not been deducted. Spendable is this wallet
balance minus shared outstanding holds; do not subtract pack holds a second time.
A hold is a claim, not a temporary debit, so the monthly refill, top-ups and
auto-top-up never see it as consumption.

## Flow

1. The trusted server resolves and authorizes the billing owner and chooses one
   stable operation key for the chargeable attempt.
2. `reserveCreditsOnce` holds the estimated maximum. `insufficient` is a definite
   denial and holds nothing, so the caller can return a machine-readable 402. Paid work
   is permitted only on a hold whose status is `held` (a `reused` receipt reports
   `held`, `settled` or `released`).

   A hold is not an execution lease. A duplicate receives a `reused` receipt with
   the hold's current status: `held`, `settled` or `released`. Closed holds never
   authorize new work. A reused `held` receipt still requires independently established
   durable dispatch ownership or reconciliation before any paid provider call;
   settlement charging once does not prevent duplicate provider work. The merged
   Context accounting consumer conservatively reconciles every reused hold instead
   of dispatching again.
3. After the work, `settleCreditReservation` charges the actual credits (at most the
   hold) through the same owner/key receipt as `recordCreditChargeOnce`, then the
   remainder stops being held. Use the existing pricing rules for the amount.
4. `releaseCreditReservation` closes a hold with no charge, for work known not to
   have incurred one (for example, cancelled before dispatch).

## Errors

- **Definite rejection:** `CreditReservationRejected`. The database raised SQLSTATE
  `22023` inside the RPC transaction and rolled it back, so the call wrote nothing.
  `reason` holds the fixed database message: a released or settled hold, a settlement
  above the hold, an identity conflict, a missing reservation, or an unavailable or
  ambiguous wallet. An unchanged replay fails the same way, so map it to a definite
  error response (for example 402 for a missing wallet, 409 for a conflict) and never
  start paid work on it.
- **Uncertain outcome:** any other RPC error, a thrown transport failure, a lost
  response or an invalid receipt raises a reconciliation error
  (`CreditReservationNeedsReconciliation` for holds and releases,
  `CreditChargeNeedsReconciliation` for settlement, which may have committed). Keep
  the same key and replay the same call to learn the state.

The adapters never retry, mint a fresh key, call providers or trigger auto-top-up.
`settleCreditReservation` does not call `maybeAutoTopUp`; a future caller must decide
that explicitly.

## Activation prerequisites

The original API1026/Database115 candidates are retained dependencies of this
successor; do not merge the old migration alone as completed wallet composition.
Before connecting any caller, release and verify the reservation migration plus
`20261117000000_compose_credit_reservations.sql` through the owning database workflow.
The latter guards wallet writes against outstanding shared holds, including legacy
debits and pack approvals. Settlement excludes only its own hold within the same
transaction; charge failure restores it. Successful reserve versions the locked wallet
row so an older repeatable-read writer fails rather than missing a newly committed hold.

Current main already has atomic `incrementRemainingCredits`, `checkAndResetCredits`
and `deductCredits` callers. The released pack migration supplies atomic increment,
adjustment and a refill floor that counts unconsumed pack holds. Open historical
Database101/API1009 PR labels are not evidence those writers are still absent.
Preserve the pack-aware refill; do not replace it with the old candidate's plain floor.

One wallet per billing owner remains a separate prerequisite (Database88). The
reservation functions reject zero/multiple wallet rows; this successor does not repair
existing rows or add that uniqueness constraint. Verify actual released grants and
schema before activation; source and disposable transactions are not hosted evidence.

## Not covered yet

- Legacy provider dispatch is not moved onto reservations. The wallet guard prevents
  a final debit from consuming promised funds, but a legacy caller may already have
  incurred provider expense before its debit fails. This is not pre-dispatch spending
  authorization or proof of bounded provider exposure. No live caller is enabled.
- No hold expiry and no API listing of open holds. Unknown provider exposure stays
  held until reconciled; the service role can find open holds in
  `credit_reservations` where `state = 'held'`.
- No request/pilot ceilings or approved failure/cancellation billing policy. The shared
  primitive stores neither pricing version nor provider expense. Existing Packs
  accounting labels do not supply those Context-specific controls.
- Existing preflight (`checkCreditsAvailable`) still reads the confirmed balance, not
  spendable credit.

Apply and verify the database migration through the database release process before
connecting a caller. Generated client types will follow that release; each adapter
narrowly types its single RPC at the access-layer boundary. Mocked adapter tests do not
prove production charging or authorization.
