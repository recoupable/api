# Disabled Context accounting consumer

This fixture-only adapter explores #2123 request and pilot ceilings around the existing credit reservation contract. It is not wired into `runRecordedContextModules`, `dispatchPlannedContextModule`, an API route, a workflow, or a provider. Every service and ceiling must be supplied; there are no production policy defaults or live storage implementation.

## Ownership and contract

Structural service ports match API #1026 at `ace711d0b1f4fd8e87e56039a27c88493203cf49` and database #115 at `e05c45487cc16fe908bfa52ba2e6e78b3789bc57`. Reconciliation owns reservation composition with released Packs, refill and other debits. This consumer adds no wallet, migration or direct database access. Its ledger counts request/pilot allocations, not spendable account credits.

The caller supplies authenticated payer, request, pilot, module and attempt identities. The stable operation key hashes those identities. Pricing and ceiling terms cannot change for an existing attempt; request-to-pilot membership and scope ceilings cannot drift. Usage events retain the existing strict charge schema; Context attribution stays in the journal. Provider expense, customer credits and result usability are separate facts.

## State and replay

The injected transaction must atomically and durably isolate a payer-partitioned ledger, roll back failed callbacks, and retain attempts and policies across deliveries. The in-memory test fixture demonstrates this contract only; it is not production persistence. Admission counts settled actual customer credits plus the maximum for every unresolved attempt. BigInt aggregation avoids unsafe cumulative arithmetic.

Only fresh admission followed by a newly held reservation permits one dispatch intent. A reused reservation is never a dispatch lease. Cancellation recorded before the atomic dispatch intent releases the reservation; cancellation after intent cannot establish that provider work did not happen. Replays never dispatch providers. Ambiguous reserve, provider, settlement or release replies retain the maximum allocation. Reconciliation can repeat only the exact saved settlement or known-safe release. A rejected settlement does not undo a previously committed hold.

Accepted, authorized retained analysis is journaled as reuse with zero new debit, even if the cache later disappears. A planner reuse candidate alone is insufficient. Endpoint-owned song analysis must not be wrapped: `billing: "endpoint_owned"` is rejected, and injected dispatch must be a leaf that does not charge independently. No existing song-analysis endpoint is wired here.

A completed zero-customer-charge operation releases rather than settling zero. Standalone work with a zero maximum is outside this adapter's scope; maximum reservation and supplied ceilings must be positive integers. A paid but unusable result can still have provider expense and customer credits according to the supplied completion; this adapter invents no refund or pricing policy.

## Validation and remaining gates

Run `pnpm exec tsc --project tsconfig.context-accounting.json` for strict source and fixture type checking. Run `pnpm exec vitest run lib/context/accounting` for synthetic concurrency, payer isolation, duplicate delivery, cancellation, retained uncertainty, lost replies, receipt validation and reuse coverage. Tests invoke no real wallet or provider.

Before production wiring, the owning lanes must supply and review durable transaction/cancellation storage, authenticated attribution, approved pricing and ceiling policy, reservation composition, authorized evidence reuse, non-charging provider leaves, and operational reconciliation. A customer credit ceiling does not prove a bound on unknown provider expense. Source tests do not prove live database, provider or customer outcomes.
