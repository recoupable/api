# Disposable registration composition qualification

This harness joins the existing unwired API create/read domain to the exact inactive Database 138 proposal in an owned disposable PostgreSQL cluster. It is not a production storage adapter, credential verifier, route, MCP tool or policy adoption.

The actual REST authentication orchestration uses the existing controlled SDK/profile/Supabase leaves. Only explicit synthetic actors are enrolled by fixture setup. Domain calls use the actual injected SQL helpers to execute one parameterized wrapper each, with setup/readback queries counted separately. No management permission is granted by create. Real SQL authorization errors `42501` map to denied. Only create-operation `P2101` maps to the existing conflict kind. Generic `P0001`, adjacent/unrecognized codes, transport failures and read-operation `P2101` remain `outcome_unknown`; no message text or SQLSTATE family is used for classification.

Historical source pair (not successor qualification): accepted local Database `f507a77696f20429f977df9885d6c8c11a5f304b` and accepted documented API successor `0769bc1957fce38bd6b847d342eae904044ae821` (the manifest's acceptedApiComposition). That successor inherits the reviewed joined qualification; `784bee20b3e0fe61e67ed156c7f3a39a08a441b2` remains the original pre-joined compatibility source recorded as originalApiCompatibility. The original apiMerge is retained as historical provenance. The policy descriptor and Database pins must match this pair; the historical df7 qualification is not reused as successor evidence.

The loss-of-response case drops the result only after actual SQL commit. Recovery explicitly reauthenticates and reuses the original key/input, then compares the SQL receipt and row count. Altered original intent now produces the definite conflict while preserving the original receipt and all five table contents. New-key stale revision, same-key fingerprint changes and authorized exact replay after revision advance are covered separately. No production retry ledger or automatic retry exists. Returned UUIDs/timestamps/flags are validated by the real domain parser; input-only read aliases remain supported.

Resolve the intended Node executable to an absolute path first, then run from the API repository with a minimal parent environment and explicit local source and tool paths:

```sh
node_path=/absolute/path/to/node
env -i PATH=/usr/bin:/bin LANG=C LC_ALL=C TZ=UTC "$node_path" \
  scripts/application-registration-proposal/sql-composition/run.mjs \
  --database-root /absolute/path/to/exact-database-proposal \
  --pg-bin /absolute/path/to/postgresql/bin \
  --python /absolute/path/to/python3
```

The minimal parent environment prevents ambient `NODE_OPTIONS` from executing code before the launcher can scrub its child. Do not supply a real `HOME` or an env file. Dependency installation happens separately and is outside this process-containment claim.

The successor local PostgreSQL 15.10/17.7 qualification uses Node 24.18.0. Earlier unchanged-runner fault controls also used Node 24.18.0 and remain historical evidence, not new successor executions. The separate loader-defect reproduction used Node 23.6.1. Node 22 has not been qualified by this local suite.

Optional `--fault signal`, `--fault timeout`, or `--fault worker-exit` controls initialize a real guarded Node descendant, then deliberately interrupt the supervisor, time out its worker, or exit its worker while the child remains alive. Each retains an expected nonzero exit, but the launcher reports `COMPOSITION_FAULT_RESULT.passed=true` only after validating the expected exit, initialized Node lineage and both worker/cluster cleanup receipts. A nonzero exit alone is not a passing fault control. These are lifecycle controls, not functional SQL passes.

The launcher verifies pinned files, tracked API source against the accepted revision (allowing only this thirteen-path adapter/qualification slice), and the exact Database head. It compares actual file bytes and types against Git blobs without trusting index flags, stat caches or clean filters. Environment files are never opened, including the tracked example; dotenv loading remains disabled. The accepted revision must be an ancestor of HEAD, and cumulative committed changes must stay within the same thirteen paths. Unexpected tracked differences, nonignored untracked files, and ignored executable sources under the API/auth and qualification directories fail before the worker starts. It then imports the reviewed database supervisor. That owner creates a UTF8 cluster without TCP listeners, scrubs the environment, owns the worker process group and verifies worker/postmaster/socket absence before removal. Node imports network denial before auth code; direct TCP/UDP creation and inbound TCP listening are denied; the PostgreSQL connector accepts only the registered owned Unix socket. The raw connector remains module-private; the global cross-import handle can only reinstall the lease-checked guard. Native guard initialization is required in the runner and each Vitest worker before the shared authentication setup. Native DNS lookup/resolve/reverse and Resolver constructors are denied in callback and promise APIs. Vitest receives only a fixed synthetic localhost answer; this never invokes OS or DNS resolution. A Node 23.6.1 loader defect can retain socket stat state during cached module-path resolution. The guard validates the owned directory after each socket stat, preserving both checks and avoiding that stale state. Dotenv is disabled. No hosted DSN, ambient credentials or arbitrary external socket is accepted.

Qualification targets PostgreSQL 15 and 17. This suite is distinct from the 130-case controlled adapter/MCP suite and ordinary Unit CI. It requires the explicitly pinned Database checkout and is not evidence of a hosted RPC, least-privilege deployment, live enrollment or public App 2104 availability. Personal policy, production authority provisioning, retention, deployed MCP nonprovisioning/original-actor handoff and client acceptance remain separate. Database 138 remains draft/unmerged/unapplied.

The thirteen candidate paths are the test code under review, not self-authenticating inputs. Record their exact commit and file hashes with each evidence packet; changing a guard, launcher or assertion invalidates earlier qualification evidence. Other tracked API inputs, including the freshly captured D golden receipt, are checked against the accepted Git tree. This SQL suite reads real SQL receipts and does not use that golden as its result oracle. The guard is an in-process test boundary, not an OS sandbox for hostile code.

The outer watchdog reports cleanup as unconfirmed if the supervisor cannot finish its bounded cleanup. It preserves the recorded lease for inspection; it does not claim that killing the supervisor or its group would remove separately sessioned workers and PostgreSQL. The focused fault controls do not exercise that outer watchdog.

## Unwired SQL helper successor

API baseline: `ec284cba127d73d0c3e7e74deceabac5c6a145f1`. Execution profile:
`acea75c0e118b6ca12bb9a22470a8bd7b383f925`, tree
`a8c45f920144db21ae1d00a807184aae51065b82`. D stays
`f507a77696f20429f977df9885d6c8c11a5f304b` in the domain policy. Earlier runs and
source pairs above are historical, not qualification for this successor.

The required structural ProposedRegistrationSqlClient accepts an already-connected pg client.
Two helpers in lib/supabase/application_registration_proposal issue fixed six-parameter create
and five-parameter read statements against application_registration_execution_proposal wrappers.
There is no global client, connection, factory, route or runtime registration. The wrapper schema
remains disposable-only, not an adopted RPC or exposed PostgREST schema.

The trusted caller must supply an idle autocommit session with intended privileges already set.
Helpers do not establish or query that state; an open caller transaction is unsupported because
it changes commit/receipt semantics. Endpoint/TLS/pooling/session reset/role selection/timeouts
and secret ownership belong to a separately reviewed deployment plan.

Exact structured 42501 means denied; P2101 means conflict only for create. Other errors,
including read P2101, malformed envelopes and serialization failures, become fresh unknown
failures without raw causes/logs or retry. Exactly one non-null receipt is returned unchanged as
unknown to actual domain validation. The domain owns strict receipt, intent and actor bindings.
SQL actor parameters remain trusted server assertions, not credential authentication.

The controller loads exact D, then the accepted roles/wrappers with the installation marker set
on that same connection. It is not authentication. D's transitive proof-composition pins remain
because unchanged D setup loads them. A separate pg client logs in as
qualification_registration_client and assumes qualification_registration_runtime during counted
setup. Only that client backs the actual helpers. Controller/setup queries are counted separately
from operations. The runtime receives no TEMP grant. Misleading-error classification controls
are labeled synthetic unit cases; no controller TEMP function stands in for runtime execution.

Actual domain/helper/wrapper/D cases cover canonical receipts, denial/conflict/replay, revocation,
post-commit response loss and cross-actor isolation. Tampering controls alter a real returned
receipt before domain validation; they are not claims of SQL corruption. Real MCP SDK create/read
uses the same helpers; changed actor and termination before storage must yield zero operation
queries. Auth leaves are controlled synthetic fixtures, not live credential verification.

The thirteen permitted candidate paths are the client interface, two operation helpers, four shared helpers, unit test and existing
README, qualification.test.ts, run.mjs, supervise.py and source-bindings.json in this directory.
The launcher requires their raw bytes/types to match its recorded candidate commit/tree. Other
API source stays bound to ec284, with D and all five profile files pinned separately to exact
commits and raw blobs/modes. Native preload/socket guard/config and D lifecycle are unchanged.
Fresh PG15/17 joined runs and signal/timeout/worker-exit cleanup controls on each version are
required. Record actual Node versions; Node24 evidence is not a Node22 qualification.

Sites owns Database139. Production policy, role adoption, enrollment, credentials, retention,
activation and deployment remain separate. A local source pass is not a release.

The four shared helpers own create/read value binding, defensive SQLSTATE mapping and receipt-envelope unwrapping, with one named export per file. Only query errors enter SQLSTATE mapping; serialization/input-access and envelope failures remain unknown. The manifest lists all thirteen exact paths, checked against the launcher allowlist, and their physical bytes/types must match the recorded candidate Git blobs. This scope expansion addresses the current CodeRabbit pre-merge duplication warning; its earlier skipped-review comment is not the final review result.
