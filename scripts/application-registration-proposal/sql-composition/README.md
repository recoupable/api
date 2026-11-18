# Disposable registration composition qualification

This harness joins the existing unwired API create/read domain to the exact inactive Database 138 proposal in an owned disposable PostgreSQL cluster. It is not a production storage adapter, credential verifier, route, MCP tool or policy adoption.

The actual REST authentication orchestration uses the existing controlled SDK/profile/Supabase leaves. Only explicit synthetic actors are enrolled by fixture setup. Domain calls execute one parameterized SQL function each, with setup/readback queries counted separately. No management permission is granted by create. Real SQL authorization errors `42501` map to denied; generic `P0001` failures remain `outcome_unknown` and are never classified from message text.

The loss-of-response case drops the result only after actual SQL commit. Recovery explicitly reauthenticates and reuses the original key/input, then compares the SQL receipt and row count. No production retry ledger or automatic retry exists. Returned UUIDs/timestamps/flags are validated by the real domain parser; input-only read aliases remain supported.

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

The final local PostgreSQL 15.10/17.7 qualification and fault controls used Node 24.18.0. The separate loader-defect reproduction used Node 23.6.1. Node 22 has not been qualified by this local suite.

Optional `--fault signal`, `--fault timeout`, or `--fault worker-exit` controls initialize a real guarded Node descendant, then deliberately interrupt the supervisor, time out its worker, or exit its worker while the child remains alive. Each retains an expected nonzero exit, but the launcher reports `COMPOSITION_FAULT_RESULT.passed=true` only after validating the expected exit, initialized Node lineage and both worker/cluster cleanup receipts. A nonzero exit alone is not a passing fault control. These are lifecycle controls, not functional SQL passes.

The launcher verifies pinned files, tracked API source against the accepted revision (allowing only this eight-path qualification slice), and the exact Database head. It compares actual file bytes and types against Git blobs without trusting index flags, stat caches or clean filters. Environment files are never opened, including the tracked example; dotenv loading remains disabled. The accepted revision must be an ancestor of HEAD, and cumulative committed changes must stay within the same eight paths. Unexpected tracked differences, nonignored untracked files, and ignored executable sources under the API/auth and qualification directories fail before the worker starts. It then imports the reviewed database supervisor. That owner creates a UTF8 cluster without TCP listeners, scrubs the environment, owns the worker process group and verifies worker/postmaster/socket absence before removal. Node imports network denial before auth code; direct TCP/UDP creation and inbound TCP listening are denied; the PostgreSQL connector accepts only the registered owned Unix socket. The raw connector remains module-private; the global cross-import handle can only reinstall the lease-checked guard. Native guard initialization is required in the runner and each Vitest worker before the shared authentication setup. Native DNS lookup/resolve/reverse and Resolver constructors are denied in callback and promise APIs. Vitest receives only a fixed synthetic localhost answer; this never invokes OS or DNS resolution. A Node 23.6.1 loader defect can retain socket stat state during cached module-path resolution. The guard validates the owned directory after each socket stat, preserving both checks and avoiding that stale state. Dotenv is disabled. No hosted DSN, ambient credentials or arbitrary external socket is accepted.

Qualification targets PostgreSQL 15 and 17. This suite is distinct from the 45-case adapter suite and ordinary Unit CI. It requires the explicitly pinned Database checkout and is not evidence of a hosted RPC, least-privilege deployment, live enrollment or public App 2104 availability. Personal policy, production authority provisioning, retention, actual MCP nonprovisioning/original-actor handoff and client acceptance remain separate. Database 138 remains draft/unmerged/unapplied.

The eight qualification paths are the test code under review, not self-authenticating inputs. Record their exact commit and file hashes with each evidence packet; changing a guard, launcher or assertion invalidates earlier qualification evidence. Other tracked API inputs, including the legacy golden receipt, are checked against the accepted Git tree. This SQL suite reads real SQL receipts and does not use that golden as its result oracle. The guard is an in-process test boundary, not an OS sandbox for hostile code.

The outer watchdog reports cleanup as unconfirmed if the supervisor cannot finish its bounded cleanup. It preserves the recorded lease for inspection; it does not claim that killing the supervisor or its group would remove separately sessioned workers and PostgreSQL. The focused fault controls do not exercise that outer watchdog.
