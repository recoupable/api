# Parent-owned disposable fixture lifecycle

Root/Catalog found a blocker at 54beb4e5: an outer timeout could kill the worker during bootstrap or shutdown, bypassing its finally block. Independent reviews additionally identified subprocess descendants, unittest cleanup deleting files after stop failure, and detached PostgreSQL existing before PID/socket files.

The corrected protocol is harness-only. API business logic and exact Database SQL/bootstrap bytes remain unchanged.

1. Parent allocates a private temporary root without an automatic deleting finalizer. Worker starts in a dedicated new session/process group containing only this fixture and its subprocesses.
2. Bootstrap directory creation is instrumented as a parent-owned lease: mkdtemp creates the directory, atomic metadata registers its absolute real path, UID/device/inode and worker PID, and bootstrap receives name plus a no-op cleanup. Neither unittest cleanup nor object finalization may delete cluster files.
3. Worker runs the unchanged bootstrap and business fixture. SIGTERM raises into its finally path. Bootstrap SQL and control operations remain enclosed by the parent deadline; normal Vitest has its own shorter deadline.
4. Parent finally always quiesces the exact worker group: TERM, bounded grace, then KILL if needed, and absence check. This includes initdb/pg_ctl/psql descendants. No global process-name kills occur.
5. Parent validates registered path containment, realpaths, directory identity and worker ownership. It independently reads untruncated process metadata (`ps -ww`) and accepts only PostgreSQL bound to the exact owned `-D` directory. Missing PID/socket files never establish absence. Ambiguous matching process data fails closed.
6. With a consistent PID file, parent uses the known pg_ctl for immediate bounded stop. For a verified live detached postmaster lacking its PID file, parent rechecks the exact process binding, sends targeted SIGQUIT, and waits boundedly for absence. Process/socket absence is verified before deletion. Uncertain identity or failed shutdown preserves the root and a diagnostic record.
7. Parent saves lifecycle/ownership/fault/PostgreSQL diagnostics outside the root, then removes files only after successful shutdown verification. A parent SIGTERM also enters this finally path; an uncatchable supervisor SIGKILL is outside this guarantee.

Independent spec and standards reviewers approved the revised plan before fault execution, including the required untruncated process inspection. Six deterministic disposable faults qualify cleanup:

- Startup-control operation held across parent deadline.
- Abrupt worker death immediately after cluster startup, before proposal setup.
- Real bootstrap SQL blocked while worker ignores TERM, forcing group termination.
- Worker shutdown exception; parent must retain the lease and stop PostgreSQL.
- Shutdown-control operation held across parent deadline.
- A real detached PostgreSQL instance whose fixture PID/socket files and registered PID are removed before abrupt worker death. This simulates the missing-file startup state; it does not claim timing control inside PostgreSQL startup.

Each requires the recorded worker group, owned postmaster, socket and directory to be absent, with retained diagnostics. Run both PostgreSQL versions using the same runner with `--self-test-cleanup`. These lifecycle tests are separate from the business-contract cases and confer no hosted/production qualification.

Fault markers are read from the current owned root before deletion and must match the current root, worker PID and requested fault. A separate regression prepopulates the output directory with an old marker, exits the new worker before bootstrap, and requires fault qualification to fail while cleanup succeeds.

The stale-marker negative specifically covers reuse of the old output-directory artifact. It does not inject a foreign root/worker marker at the current-root read path; those identity comparisons are source-reviewed guards, not separately fault-tested controls.
