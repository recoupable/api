# Stable charge receipts

`recordCreditChargeOnce` in `lib/supabase/credits_usage` is an opt-in adapter to the
additive database `record_credit_charge_once` function. It has no production callers
and does not replace `recordCreditDeduction` or enable Context/Sites spending.

The caller must resolve and authorize the billing owner, use a durable operation key
for exactly one chargeable attempt, and supply the charge under the existing pricing
policy. Same owner/key/normalized charge returns the original receipt on replay;
changed inputs conflict. Use the same key after response loss. Never replay providers
to repair accounting or wrap an already-charging endpoint with another charge.

Inputs are validated before touching the wallet. RPC errors, lost responses and
invalid receipts throw `CreditChargeNeedsReconciliation`, retaining an internal cause
without exposing raw diagnostics in the outward message. No internal retry, random
charge ID, provider call or auto-top-up occurs. The helper does not reserve credits,
prevent overspending or implement per-request/pilot ceilings. These remain required
before wiring a paid Context caller under app#2123 and shared accounting app#2105.

Database migration: `20261009000000_record_credit_charge_once.sql`. Apply and verify
it through the database release process before connecting callers. The generated
client types will follow database release; this adapter narrowly types the single
RPC at its access-layer boundary. Existing audit events must be retained unchanged
for replay safety; any future retention/purge policy needs durable deduplication.

Validation: 13 adapter cases plus 11 existing charge tests pass. The database PR has
real disposable PostgreSQL concurrency/rollback tests. Mocked adapter tests do not
prove production charging or authorization. No real balances or flags were changed.

## Atomic wallet adjustments

`refillCreditsToFloor` (`refill_credits_to_floor`) and `incrementRemainingCredits`
(`increment_credits_atomic`) in `lib/supabase/credits_usage` replace two of the legacy
writers that wrote a balance read earlier: the monthly plan refill now applies its
floor with GREATEST inside the locked wallet row, and the Stripe top-up adds its delta
in place. The refill also sends the refill timestamp it read; the database applies it
only while that timestamp is still current and otherwise returns `superseded` with the
current balance, so concurrent reads of one stale row refill a period once and a debit
after that refill is not resurrected. Both take the same single-row lock as
`record_credit_charge_once`, write no usage event and never call auto-top-up.

These two writers no longer lose concurrent atomic wallet changes. The unaudited
read-modify-write in `lib/credits/deductCredits.ts` (research, content and
site-production charges) is unchanged and can still overwrite a top-up, refill or
charge that lands between its read and write; it is the next slice. They are not
reservations: before-call holds, request/pilot ceilings and provider-expense versus
customer-debit reporting remain outstanding under app#2123 / app#2105. Database
migration: `20261010212300_credit_wallet_atomic_adjustments.sql`, released before this
API change.
