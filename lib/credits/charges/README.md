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
