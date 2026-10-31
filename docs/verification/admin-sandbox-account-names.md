# Admin sandbox account names

## Original requirement and bounded repair

API #283 at `09aac7177963b88ed0554e0ece937fa9d3299b88` added four files and
four hunks for an admin-only sandbox summary including the real account name.
The current canonical `GET /api/admins/sandboxes` preserves counts, ordering,
timestamps and admin authorization, but returns only `account_email` as its
display identifier. This repair starts from main
`d6469aef644c0f2c035229afb2136b4a60399b4f` and adds the original name field
alongside the existing email field.

Each response row now includes:

- `account_id`: unchanged account identifier.
- `account_email`: unchanged email mapping, including its existing null behavior.
- `account_name`: the stored `accounts.name`, or null when the account/name is
  absent. An empty stored name remains empty. Email is never used as a name.
- `total_sandboxes` and `last_created_at`: unchanged aggregated count and latest
  creation timestamp; rows retain descending timestamp order.

The database type already defines `accounts.name` as `string | null`. The
existing owning `lib/supabase/accounts/selectAccounts.ts` reader accepts an
array of IDs and throws on a database error. No migration, new wrapper or
schema interpretation is required.

`validateAdminAuth` still runs before aggregation or enrichment. Only after
that gate and nonempty sandbox stats does the handler perform one names batch
and the existing emails batch. Names are joined by account ID, independently
of database row order. Empty stats skip both reads. A failed names query
reaches the existing generic 500 `{ status: "error", message: "Internal server
error" }`; it is not converted into successful null names. Existing email
wrapper behavior and aggregation failure behavior are unchanged.

This is additive on the current route. The old
`/api/admins/accounts-with-sandboxes` alias is not restored. Existing admin
authority, authentication defaults, CORS and error envelopes remain intact.
No new permissions, account changes or customer-data operations are introduced.

## Offline verification and remaining acceptance

The new actual-route suite imports the real handler, admin gate, membership
check and aggregation, with only identity and database boundaries mocked.
The unchanged baseline produced six failures for names/read failures and four
passing denial/empty/aggregation-error controls. Tests cover admin denial
before all data reads, one batch after authorization, names by ID, preserved
emails/counts/order, missing/null/empty names, no invented email fallback,
independent missing email, empty stats and generic query failure.

Existing handler, route-shell, aggregation and batch-reader tests remain as
controls. Verification runs under a process-wide network guard; no identity,
provider, database, account or customer operation is performed live. The prior
full #283 patch is reconciled as source evidence, not as deployment or client
acceptance. The coordinator retains merge, original-scope disposition and any
separately authorized hosted/admin-client acceptance. No original PR or linked
issue is closed by this source repair.
