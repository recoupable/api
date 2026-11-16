# Local disabled catalog adapter / SQL qualification

Runs the actual API1170 management adapter and its two RPC wrappers against the
accepted Database123 SQL on disposable PostgreSQL15/17. It is an explicit local
qualification, not part of the default Vitest glob or a production transport.

Prerequisites: existing API dependencies, installed PostgreSQL15 or17 binaries, and
a local Database checkout containing accepted commit
`5aff2df9ed853e671f044ffa5dc986099e622549`. No download or remote database access occurs.
From the API worktree:

```sh
python3 scripts/catalog-storage-integration/run.py \
  --database-repo /absolute/path/to/database-checkout \
  --pg-bin /opt/homebrew/opt/postgresql@15/bin
python3 scripts/catalog-storage-integration/run.py \
  --database-repo /absolute/path/to/database-checkout \
  --pg-bin /opt/homebrew/opt/postgresql@17/bin
pnpm exec tsc -p tsconfig.catalog-storage.json
```

The runner byte-verifies the Database setup fixture and SQL against that exact Git
commit before import. It reuses only fixture setup/seed/cleanup, not the unchanged
15-test SQL suite. The fixture loads actual pinned dependency migrations including
RLS, and a minimal accounts table/timestamp helper; it does not replay every legacy
production migration. API production modules and SQL are unchanged by this harness.

Each run creates a fresh Unix-socket-only cluster under a temporary directory,
clears inherited libpq environment options, seeds synthetic identities and exact
personal/org catalog links, and stops/removes the cluster in finally cleanup. The
transport requires the disposable directory marker and verifies data_directory and
server major version. CLI host is an absolute local socket directory, never a URL
or TCP host. Tests call SQL as service_role through the two exact SECURITY DEFINER
RPCs. Test-owner SQL is used only to inspect fixture rows and revoke fixture links.
Do not reuse this fixture transport or its owner helper in application code.

Nine integration scenarios cover:

- create/read/edit_disabled/disable/archive with actual PostgreSQL JSON/timestamps;
- historical create/edit/archive receipts after newer revisions, without new writes;
- changed same-request input and stale CAS denial;
- another key for the same actor and another Privy subject denied by SQL;
- wrong explicit workspace denied before mutation;
- current membership and exact owner-link revocation, despite a synthetic auth seam
  still allowing the request (personal visibility cannot replace an org link);
- malformed workspace/serialization rejected before authentication or RPC;
- a real committed create followed by an injected transport throw: no automatic
  retry, followed by an explicit same-command/key retry returning the stored receipt;
- SQL timezone-catalog rejection with sanitized adapter error.

Only `resolveCatalogReportScope` is mocked, supplying fresh synthetic verified
observations per call. This is deliberate: it isolates adapter-to-SQL qualification
and proves the SQL independently enforces its current-access checks. It does not
prove real API-key/Privy verification, email-to-account continuity, hosted PostgREST,
production RLS composition, deployment, or unattended execution. The psql adapter
returns the same data/error shape and SQLSTATE code used by the production-facing
interface, but is not a PostgREST network-stack test. No SQL apply, generated type
refresh, hosted binding, public route, enable/scheduler/provider action is included.

The initial red failed on the missing transport module. The first sandboxed cluster
attempt failed during initdb before tests; the permitted local cluster run then
passed on PostgreSQL15.10 and17.7. Disposable setup/teardown evidence is retained
with the qualification packet; passing these tests does not authorize activation.
