# Disposable registration composition qualification

This harness joins the existing unwired API create/read domain to the exact inactive Database 138 proposal in an owned disposable PostgreSQL cluster. It is not a production storage adapter, credential verifier, route, MCP tool or policy adoption.

The actual REST authentication orchestration uses the existing controlled SDK/profile/Supabase leaves. Only explicit synthetic actors are enrolled by fixture setup. Domain calls execute one parameterized SQL function each, with setup/readback queries counted separately. No management permission is granted by create. Real SQL authorization errors `42501` map to denied; generic `P0001` failures remain `outcome_unknown` and are never classified from message text.

The loss-of-response case drops the result only after actual SQL commit. Recovery explicitly reauthenticates and reuses the original key/input, then compares the SQL receipt and row count. No production retry ledger or automatic retry exists. Returned UUIDs/timestamps/flags are validated by the real domain parser; input-only read aliases remain supported.

Run with explicit local source and tool paths:

```sh
node scripts/application-registration-proposal/sql-composition/run.mjs \
  --database-root /absolute/path/to/exact-database-proposal \
  --pg-bin /absolute/path/to/postgresql/bin \
  --python /absolute/path/to/python3
```

Optional `--fault signal`, `--fault timeout`, or `--fault worker-exit` controls initialize a real guarded Node descendant, then deliberately interrupt the supervisor, time out its worker, or exit its worker while the child remains alive. Each must fail and still report verified cleanup. These are lifecycle controls, not functional SQL passes.

The launcher verifies pinned files and exact Database head before importing the reviewed database supervisor. That owner creates a UTF8 cluster without TCP listeners, scrubs the environment, owns the worker process group and verifies worker/postmaster/socket absence before removal. Node imports network denial before auth code; direct TCP and UDP creation is denied; the PostgreSQL connector accepts only the registered owned Unix socket. Native guard initialization is required in the runner and each Vitest worker before the shared authentication setup. Native DNS lookup/resolve/reverse and Resolver constructors are denied in callback and promise APIs. Vitest receives only a fixed synthetic localhost answer; this never invokes OS or DNS resolution. A Node 23.6.1 loader defect can retain socket stat state during cached module-path resolution. The guard validates the owned directory after each socket stat, preserving both checks and avoiding that stale state. Dotenv is disabled. No hosted DSN, ambient credentials or arbitrary external socket is accepted.

Qualification targets PostgreSQL 15 and 17. This suite is distinct from the 45-case adapter suite and ordinary Unit CI. It requires the explicitly pinned Database checkout and is not evidence of a hosted RPC, least-privilege deployment, live enrollment or public App 2104 availability. Personal policy, production authority provisioning, retention, actual MCP nonprovisioning/original-actor handoff and client acceptance remain separate. Database 138 remains draft/unmerged/unapplied.
