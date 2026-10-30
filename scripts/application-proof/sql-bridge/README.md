# Offline actual API → SQL configuration bridge

October 27, 2026. This closes a source integration gap between the existing
[API rehearsal #1191](https://github.com/recoupable/api/pull/1191) and
[Database writer #131](https://github.com/recoupable/database/pull/131). It is not a
runtime adapter, endpoint, management policy, migration or activation path.

## Actual code and source pins

`sources.json` pins five API modules at merge commit
`959d30bf19f28ae6a8c75031f424831923403374` and five Database fixture/protocol files at
`372de990156739dda1b605d18a40333cd6f1bdba`, each by SHA-256. The runner verifies API
working-file bytes, then the dedicated Vitest loader hashes and freezes those bytes
again and executes that same cache. Its shutdown check requires all five pinned
modules to have passed through the loader. The runner obtains Database bytes with local
`git show <pinned-commit>:<file>`. It does not fetch during qualification, copy the
SQL into this repository, or recreate its schema or transaction logic. The actual
preflight schema/validator and `rehearseConfigurationInvocation` execute in Vitest;
only organization membership and explicitly injected fixture decisions are mocked.
SQL runs the pinned real `configure_return_urls` function in a disposable cluster.

The dedicated workflow checks out the public Database repository at that exact
commit. This read-only source checkout is separate from test execution. No hosted
DSN, provider credentials, DNS query, grants or publication are used by the harness.
Changing a pinned dependency requires deliberate pin review and requalification;
a source mismatch aborts before cluster creation. The original functions are unchanged.

## Bridge behavior

`invokeConfigurationSqlFixture` receives the original plan and caller-retained
idempotency key. It passes actor/resource binding, complete expected snapshot and
sorted changes to the actual SQL function. It neither generates a new key nor
retries, catches a conflict as success, or fabricates a replacement receipt.
SQL owns authorization, serialization, idempotency and immutable receipt storage.
The bridge uses escaped SQL literals through an explicitly injected fixture
transport; it is not a production query adapter. The test transport calls `psql`
without a shell and requires the runner's absolute Unix-socket path and fixture
marker. No arbitrary network hostname or connection-string parameter exists.

The returned SQL JSON is strictly checked for receipt identity/timestamp, actor,
workspace/application/environment/operation, exact original baseline and changes,
and all disabled production/access flags. The expected after-state is assembled
from the actual rehearsal's `change.next` values and destination lists—no new
revision arithmetic or alternate origin parser is introduced. The entire returned
after snapshot must match, including unchanged origins and proof revisions.
Malformed, altered or activation-bearing receipts are rejected.

After successful validation the bridge returns **both**:

- The actual immutable SQL receipt, including its recorded before/after snapshots,
  receipt ID and server timestamp.
- The existing rehearsal's exact `fixture-only-result` acknowledgment, preserving
  `persisted: false`, `bootstrap_enabled: false`, `access_activated: false` and its
  original plan. Here `persisted: false` belongs to the historical rehearsal
  envelope; it does not deny that the disposable database committed fixture rows.
  The SQL receipt separately says `production_persisted: false` and
  `evidence_kind: synthetic_configuration`.

An acknowledgment is never created before receipt validation. It confers no
management authority, proof of domain control, production persistence or access.

## Unknown outcomes and conflicts

Capture the complete plan and original key before dispatch. If transport fails
with unknown outcome, preserve those values and replay them directly through the
same bridge, subject to SQL's fresh authority check. Do not rerun the rehearsal
against newer parent state to manufacture a new request: it might produce a no-op
or different baseline and would lose the original receipt association. Do not
invent a new key. Changed payload on the original key conflicts in SQL.

The test actually commits in PostgreSQL, discards the transport response, and then
recovers the original receipt with the original key/plan. Receipt count, key and
full original JSON are checked; no timestamp extension or duplicate mutation is
accepted. Conflicts and SQL authority revocation propagate through the actual API
rehearsal without automatic retry. Fault injection drops a real committed response;
it does not replace the database with a simulated result.

## Authority and remaining boundary

With no API fixture authority, the rehearsal rejects before reading a parent or
invoking SQL. With its explicit test marker but SQL's original default-denied
adapter, the actual SQL operation still rejects and stores nothing. Only loading
the pinned `fixture-authority.sql` in the disposable cluster allows the successful
cases. That override is not real membership, a management role or a delegated grant.
The test marker is never sent as SQL authority. The real production authority
boundary therefore remains **blocked by unadopted management/delegated policy**;
this harness demonstrates wiring under declared fixtures, not permission to expose it.

Other unresolved runtime gates remain the production parent mapping and writer
protocol, service privileges, canonical request adapter, retention, resolver/origin
eligibility, consumer revocation and activation. No route imports this module.
Provider/independent-host/mobile acceptance and the separate browser hold are unchanged.

## Run and evidence

Install the API's existing dependencies, put PostgreSQL binaries from one version
on PATH, and provide a local Database repository containing the pinned commit:

```sh
python3 scripts/application-proof/sql-bridge/run.py --database-repo /absolute/path/to/database
```

The runner creates a temporary cluster listening only on its Unix socket, loads
verified SQL bytes, records source identities/PostgreSQL version, runs the integration
suite, and stops/removes the cluster even on test failure. It does not use a hosted
connection or modify the supplied Database checkout. Its marker is an accidental-
misconfiguration guard, not a security credential.

The dedicated CI workflow runs PostgreSQL 15 and 17. Normal unit runs skip these
integration cases when no runner-created socket exists; a skipped suite is not a
passing integration result. The runner supplies the socket and runs the original ten bridge cases:
API/default SQL denial, full successful mapping, quoted URL round-trip, absent
transport, real snapshot conflict, real authority revocation, committed-response
loss/recovery, receipt tampering rejection, and actual preflight rejection.

## Composed local lifecycle

See [LOCAL-FLOW.md](LOCAL-FLOW.md) for the additional synthetic personal-account registration, proof and status flow. The same runner also executes its six integration scenarios serially against the disposable cluster. The existing TXT contract model is the fifth frozen API module.
