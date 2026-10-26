# Disabled catalog schedule management adapter (unwired)

Internal source-only adapter for Database123's two-RPC offline prototype at
`5aff2df9ed853e671f044ffa5dc986099e622549`, tree
`ef5f8558071a6498f18efff51b1fbe53ec9f29aa`, under
`proposals/catalog-weekly-storage-1867/disabled-storage.sql`.
Database123 remains unmerged/unapplied. This module has no public route, MCP tool,
production transport binding, scheduler, enable action, provider effect, or generated
production schema change. SQL remains owned by Database; it is not copied here.

`manageDisabledCatalogSchedule(request, scope, operation, transport)` takes an
explicit `{catalog_id, organization_id}` scope, where personal workspace is explicit
null. Read is `{action:"read", id}`. Mutations are `{request_id, command}`;
command is the exact SQL `{action, payload}` create/edit_disabled/disable/archive
union. A create payload repeats the scope and must match it. No client actor,
effective account, recipient, principal, prompt, arbitrary cadence, or unknown key
is accepted. UUIDs remain canonical lowercase and are not normalized. The adapter
checks the SQL weekly/timezone grammar; only PostgreSQL's pg_timezone_names decides
whether a timezone actually exists. No Intl alias/DST/next-run assertion is made.

Each invocation calls existing `resolveCatalogReportScope`, which calls
`validateAuthContext` with verification evidence, no account override, and existing
accounts only. Actor must equal effective account with self access. The API-key
principal uses the actual row ID emitted by `getAccountIdByApiKey` after hashed lookup
and TTL validation. It does not invent an ID or establish an immutable-key lifecycle
contract. Privy app/issuer/subject come from `getEmailByAuthToken`'s verified token and
matching fetched user; account resolution still uses the existing email linkage.
This preserves current verifier semantics, not unattended Privy continuity or a new
account-linking guarantee. Credentials, hashes and email never enter RPC arguments.

Database calls live under `lib/supabase/catalog_report_schedules/`. A trusted caller
must explicitly inject the narrow two-RPC transport; there is no default production
client and no cast pretending the unapplied RPCs exist in generated types. The
transport is a composition dependency, never client input or an auth grant. SQL must
independently enforce original principal, current membership/exact owner link, immutable
scope, disabled-only state, CAS and receipt replay on each invocation.

Reads and existing-ID mutations first validate the returned stored scope against the
fresh requested scope. They never mutate an ID whose readback belongs elsewhere.
That read is not an atomic reservation; SQL rechecks authority and CAS. A later
revision does not suppress an exact historical receipt replay, so the adapter does
not preempt SQL with a current-revision comparison. Responses are strict, disabled,
scope/ID matched and mutation-revision/cadence/archive-state matched. A replayed
snapshot is historical; it is not current state or an execution permission.

Errors expose only generic messages. No transport failure, stale revision or malformed
response triggers automatic retry. A mutation may have committed before a transport
or response-validation failure; callers must treat that outcome as uncertain and
use the same request UUID and exact command for any explicitly chosen retry. This
adapter does not autonomously retry or adopt another creator's occupied slot.

Tests use mocked authority observations and injected RPC results. Existing authority
tests cover the shared resolver; no real credential, hosted PostgREST/DB, SQL apply,
provider or production behavior is exercised. No whole-catalog coverage or scheduling
grant follows. The App unavailable guard remains unchanged.
